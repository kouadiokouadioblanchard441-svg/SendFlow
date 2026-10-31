import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  db,
  desc,
  emailCampaignAttemptsTable,
  emailCampaignRecipientsTable,
  emailCampaignsTable,
  eq,
  gt,
  lt,
  isNull,
  inArray,
  count,
  lte,
  ne,
  or,
  usersTable,
} from "@workspace/db";
import { decryptSensitiveDataIfEncrypted } from "../lib/sensitive-data-crypto";
import {
  campaignRetryDelayMs,
  isCampaignDispatchEnabled,
  isRetryableCampaignEmailFailure,
  isCampaignRecipientEligible,
  campaignProviderIdempotencyKey,
} from "../lib/email-campaign-policy";
import { ResendConfigurationError, ResendDeliveryError, sendResendEmail } from "../lib/resend-email";
import { createEmailUnsubscribeToken } from "../lib/email-marketing-unsubscribe";

const MAX_ATTEMPTS = 4;
const BATCH_SIZE = 5;
const STALE_LOCK_MS = 2 * 60_000;
const POLL_INTERVAL_MS = 5_000;

type WorkerLogger = {
  error: (context: Record<string, unknown>, message: string) => void;
  info?: (context: Record<string, unknown>, message: string) => void;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function renderPlainTextEmail(bodyText: string, unsubscribeUrl: string) {
  const escaped = escapeHtml(bodyText);
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escaped}</div><hr><p style="font-family:Arial,sans-serif;font-size:12px;color:#555">Vous recevez ce message car vous avez accepté les communications SendFlow. <a href="${safeUnsubscribeUrl}">Se désinscrire</a></p>`;
}

async function refreshCampaignStatus(campaignId: string) {
  await db.transaction(async (transaction) => {
    const [campaign] = await transaction.select({ status: emailCampaignsTable.status })
      .from(emailCampaignsTable)
      .where(eq(emailCampaignsTable.id, campaignId))
      .for("update")
      .limit(1);
    if (!campaign || campaign.status === "cancelled") return;
    const statuses = await transaction.select({
      status: emailCampaignRecipientsTable.status,
      value: count(),
    }).from(emailCampaignRecipientsTable)
      .where(eq(emailCampaignRecipientsTable.campaignId, campaignId))
      .groupBy(emailCampaignRecipientsTable.status);
    const pending = statuses.some((item) => item.status === "queued" || item.status === "sending");
    if (pending) {
      await transaction.update(emailCampaignsTable).set({
        status: "sending",
        updatedAt: new Date(),
      }).where(and(
        eq(emailCampaignsTable.id, campaignId),
        ne(emailCampaignsTable.status, "cancelled"),
      ));
      return;
    }
    const accepted = Number(statuses.find((item) => item.status === "accepted")?.value ?? 0);
    const failed = Number(statuses.find((item) => item.status === "failed")?.value ?? 0);
    const cancelled = Number(statuses.find((item) => item.status === "cancelled")?.value ?? 0);
    const finalStatus = accepted > 0 && failed === 0 && cancelled === 0
      ? "completed"
      : "completed_with_errors";
    await transaction.update(emailCampaignsTable).set({
      status: finalStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(emailCampaignsTable.id, campaignId),
      ne(emailCampaignsTable.status, "cancelled"),
    ));
  });
}

async function claimNextRecipient() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return db.transaction(async (transaction) => {
    // Lock order is campaign -> recipient -> attempt. Cancellation and retries
    // use the same campaign-first order, avoiding the previous lock inversion.
    const [queuedCampaign] = await transaction.select({
      campaignId: emailCampaignsTable.id,
    }).from(emailCampaignsTable)
      .innerJoin(emailCampaignRecipientsTable, eq(emailCampaignRecipientsTable.campaignId, emailCampaignsTable.id))
      .where(and(
        inArray(emailCampaignsTable.status, ["queued", "sending"]),
        eq(emailCampaignRecipientsTable.status, "queued"),
        or(
          isNull(emailCampaignRecipientsTable.nextAttemptAt),
          lte(emailCampaignRecipientsTable.nextAttemptAt, now),
        ),
      ))
      .orderBy(asc(emailCampaignRecipientsTable.createdAt))
      .limit(1)
      .for("update", { of: emailCampaignsTable, skipLocked: true });

    if (queuedCampaign) {
      const [recipient] = await transaction.select({
        id: emailCampaignRecipientsTable.id,
        campaignId: emailCampaignsTable.id,
        userId: usersTable.id,
        attempts: emailCampaignRecipientsTable.attempts,
        manualRetries: emailCampaignRecipientsTable.manualRetries,
        subject: emailCampaignsTable.subject,
        bodyText: emailCampaignsTable.bodyText,
        emailSnapshotEncrypted: emailCampaignRecipientsTable.emailSnapshotEncrypted,
        currentEmailEncrypted: usersTable.emailEncrypted,
        accountStatus: usersTable.status,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        emailMarketingConsentAt: usersTable.emailMarketingConsentAt,
        emailMarketingUnsubscribedAt: usersTable.emailMarketingUnsubscribedAt,
      }).from(emailCampaignRecipientsTable)
        .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
        .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
        .where(and(
          eq(emailCampaignRecipientsTable.campaignId, queuedCampaign.campaignId),
          eq(emailCampaignRecipientsTable.status, "queued"),
          or(
            isNull(emailCampaignRecipientsTable.nextAttemptAt),
            lte(emailCampaignRecipientsTable.nextAttemptAt, now),
          ),
        ))
        .orderBy(asc(emailCampaignRecipientsTable.createdAt))
        .limit(1)
        .for("update", { of: emailCampaignRecipientsTable, skipLocked: true });
      if (recipient) {
        const emailSnapshotEncrypted = recipient.emailSnapshotEncrypted ?? recipient.currentEmailEncrypted;
        const eligible = isCampaignRecipientEligible({
          accountStatus: recipient.accountStatus,
          emailEncrypted: emailSnapshotEncrypted,
          emailVerifiedAt: recipient.emailVerifiedAt,
          emailMarketingConsentAt: recipient.emailMarketingConsentAt,
          emailMarketingUnsubscribedAt: recipient.emailMarketingUnsubscribedAt,
        });
        if (!eligible) {
          await transaction.update(emailCampaignRecipientsTable).set({
            status: "cancelled",
            lastErrorClass: "recipient_not_eligible",
            nextAttemptAt: null,
            processingStartedAt: null,
            updatedAt: now,
          }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
          return { campaignId: recipient.campaignId, skipped: true as const };
        }

        const [attemptCount] = await transaction.select({ value: count() })
          .from(emailCampaignAttemptsTable)
          .where(eq(emailCampaignAttemptsTable.recipientId, recipient.id));
        const attemptNumber = Number(attemptCount?.value ?? 0) + 1;
        const attemptId = randomUUID();
        const idempotencyKey = campaignProviderIdempotencyKey(recipient.id, recipient.manualRetries);
        await transaction.insert(emailCampaignAttemptsTable).values({
          id: attemptId,
          recipientId: recipient.id,
          attemptNumber,
          status: "sending",
          idempotencyKey,
          emailSnapshotEncrypted,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        });
        const attempts = recipient.attempts + 1;
        await transaction.update(emailCampaignRecipientsTable).set({
          status: "sending",
          attempts,
          emailSnapshotEncrypted,
          processingStartedAt: now,
          updatedAt: now,
        }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
        await transaction.update(emailCampaignsTable).set({
          status: "sending",
          updatedAt: now,
        }).where(eq(emailCampaignsTable.id, recipient.campaignId));
        return {
          id: recipient.id,
          campaignId: recipient.campaignId,
          userId: recipient.userId,
          attempts,
          manualRetries: recipient.manualRetries,
          subject: recipient.subject,
          bodyText: recipient.bodyText,
          emailSnapshotEncrypted,
          idempotencyKey,
          attemptId,
          accountStatus: recipient.accountStatus,
          emailVerifiedAt: recipient.emailVerifiedAt,
          emailMarketingConsentAt: recipient.emailMarketingConsentAt,
          emailMarketingUnsubscribedAt: recipient.emailMarketingUnsubscribedAt,
          skipped: false as const,
        };
      }
    }

    const [staleCampaign] = await transaction.select({
      campaignId: emailCampaignsTable.id,
    }).from(emailCampaignsTable)
      .innerJoin(emailCampaignRecipientsTable, eq(emailCampaignRecipientsTable.campaignId, emailCampaignsTable.id))
      .where(and(
        eq(emailCampaignsTable.status, "sending"),
        eq(emailCampaignRecipientsTable.status, "sending"),
        gt(emailCampaignRecipientsTable.processingStartedAt, new Date(0)),
        lt(emailCampaignRecipientsTable.processingStartedAt, staleBefore),
      ))
      .orderBy(asc(emailCampaignRecipientsTable.processingStartedAt))
      .limit(1)
      .for("update", { of: emailCampaignsTable, skipLocked: true });
    if (!staleCampaign) return null;

    const [stale] = await transaction.select({
      id: emailCampaignRecipientsTable.id,
      campaignId: emailCampaignsTable.id,
      userId: usersTable.id,
      attempts: emailCampaignRecipientsTable.attempts,
      manualRetries: emailCampaignRecipientsTable.manualRetries,
      subject: emailCampaignsTable.subject,
      bodyText: emailCampaignsTable.bodyText,
      emailSnapshotEncrypted: emailCampaignRecipientsTable.emailSnapshotEncrypted,
      currentEmailEncrypted: usersTable.emailEncrypted,
      accountStatus: usersTable.status,
      emailVerifiedAt: usersTable.emailVerifiedAt,
      emailMarketingConsentAt: usersTable.emailMarketingConsentAt,
      emailMarketingUnsubscribedAt: usersTable.emailMarketingUnsubscribedAt,
    }).from(emailCampaignRecipientsTable)
      .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
      .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
      .where(and(
        eq(emailCampaignRecipientsTable.campaignId, staleCampaign.campaignId),
        eq(emailCampaignRecipientsTable.status, "sending"),
        lt(emailCampaignRecipientsTable.processingStartedAt, staleBefore),
      ))
      .orderBy(asc(emailCampaignRecipientsTable.processingStartedAt))
      .limit(1)
      .for("update", { of: emailCampaignRecipientsTable, skipLocked: true });
    if (!stale) return null;

    const emailSnapshotEncrypted = stale.emailSnapshotEncrypted ?? stale.currentEmailEncrypted;
    const [latestAttempt] = await transaction.select()
      .from(emailCampaignAttemptsTable)
      .where(eq(emailCampaignAttemptsTable.recipientId, stale.id))
      .orderBy(desc(emailCampaignAttemptsTable.attemptNumber))
      .limit(1)
      .for("update");
    const eligible = isCampaignRecipientEligible({
      accountStatus: stale.accountStatus,
      emailEncrypted: emailSnapshotEncrypted,
      emailVerifiedAt: stale.emailVerifiedAt,
      emailMarketingConsentAt: stale.emailMarketingConsentAt,
      emailMarketingUnsubscribedAt: stale.emailMarketingUnsubscribedAt,
    });
    if (!eligible) {
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "failed",
        lastErrorClass: "delivery_outcome_unknown",
        processingStartedAt: null,
        updatedAt: now,
      }).where(eq(emailCampaignRecipientsTable.id, stale.id));
      if (latestAttempt) {
        await transaction.update(emailCampaignAttemptsTable).set({
          status: "failed",
          errorClass: "delivery_outcome_unknown",
          finishedAt: now,
          updatedAt: now,
        }).where(eq(emailCampaignAttemptsTable.id, latestAttempt.id));
      }
      return { campaignId: stale.campaignId, skipped: true as const };
    }

    let attemptId = latestAttempt?.id;
    let idempotencyKey = latestAttempt?.idempotencyKey;
    if (!latestAttempt) {
      const [attemptCount] = await transaction.select({ value: count() })
        .from(emailCampaignAttemptsTable)
        .where(eq(emailCampaignAttemptsTable.recipientId, stale.id));
      attemptId = randomUUID();
      idempotencyKey = campaignProviderIdempotencyKey(stale.id, stale.manualRetries);
      await transaction.insert(emailCampaignAttemptsTable).values({
        id: attemptId,
        recipientId: stale.id,
        attemptNumber: Number(attemptCount?.value ?? 0) + 1,
        status: "sending",
        idempotencyKey,
        emailSnapshotEncrypted,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await transaction.update(emailCampaignRecipientsTable).set({
      emailSnapshotEncrypted,
      processingStartedAt: now,
      updatedAt: now,
    }).where(eq(emailCampaignRecipientsTable.id, stale.id));
    return {
      id: stale.id,
      campaignId: stale.campaignId,
      userId: stale.userId,
      attempts: stale.attempts,
      manualRetries: stale.manualRetries,
      subject: stale.subject,
      bodyText: stale.bodyText,
      emailSnapshotEncrypted,
      idempotencyKey: idempotencyKey!,
      attemptId: attemptId!,
      accountStatus: stale.accountStatus,
      emailVerifiedAt: stale.emailVerifiedAt,
      emailMarketingConsentAt: stale.emailMarketingConsentAt,
      emailMarketingUnsubscribedAt: stale.emailMarketingUnsubscribedAt,
      skipped: false as const,
    };
  });
}

async function deliverOne(logger: WorkerLogger) {
  const claim = await claimNextRecipient();
  if (!claim) return false;
  if (claim.skipped) {
    await refreshCampaignStatus(claim.campaignId);
    return true;
  }
  const recipient = claim;
  const now = new Date();

  const email = decryptSensitiveDataIfEncrypted(recipient.emailSnapshotEncrypted, "user-email");
  if (!email) {
    await db.transaction(async (transaction) => {
      await transaction.update(emailCampaignAttemptsTable).set({
        status: "failed",
        errorClass: "recipient_address_unavailable",
        finishedAt: now,
        updatedAt: now,
      }).where(and(
        eq(emailCampaignAttemptsTable.id, recipient.attemptId),
        eq(emailCampaignAttemptsTable.status, "sending"),
      ));
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "failed",
        lastErrorClass: "recipient_address_unavailable",
        processingStartedAt: null,
        updatedAt: now,
      }).where(and(
        eq(emailCampaignRecipientsTable.id, recipient.id),
        eq(emailCampaignRecipientsTable.status, "sending"),
      ));
    });
    await refreshCampaignStatus(recipient.campaignId);
    return true;
  }

  try {
    const unsubscribeToken = createEmailUnsubscribeToken(
      recipient.userId,
      process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "",
    );
    const unsubscribeUrl = new URL("/email-unsubscribe", process.env.SENDFLOW_PUBLIC_SITE_URL)
      .toString() + `?token=${encodeURIComponent(unsubscribeToken)}`;
    const sent = await sendResendEmail({
      to: email,
      subject: recipient.subject,
      text: `${recipient.bodyText}\n\nVous recevez ce message car vous avez accepté les communications SendFlow.\nSe désinscrire : ${unsubscribeUrl}`,
      html: renderPlainTextEmail(recipient.bodyText, unsubscribeUrl),
    }, {
      idempotencyKey: recipient.idempotencyKey,
    });
    await db.transaction(async (transaction) => {
      const finishedAt = new Date();
      const [updatedAttempt] = await transaction.update(emailCampaignAttemptsTable).set({
        status: "accepted",
        providerMessageId: sent.messageId,
        errorClass: null,
        httpStatus: null,
        finishedAt,
        updatedAt: finishedAt,
      }).where(and(
        eq(emailCampaignAttemptsTable.id, recipient.attemptId),
        inArray(emailCampaignAttemptsTable.status, ["sending", "failed"]),
      )).returning({ id: emailCampaignAttemptsTable.id });
      if (!updatedAttempt) return;
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "accepted",
        providerMessageId: sent.messageId,
        acceptedAt: finishedAt,
        processingStartedAt: null,
        nextAttemptAt: null,
        lastErrorClass: null,
        lastErrorStatus: null,
        updatedAt: finishedAt,
      }).where(and(
        eq(emailCampaignRecipientsTable.id, recipient.id),
        inArray(emailCampaignRecipientsTable.status, ["sending", "queued"]),
      ));
    });
  } catch (error) {
    const statusCode = error instanceof ResendDeliveryError ? error.statusCode : null;
    const retry = !(error instanceof ResendConfigurationError)
      && recipient.attempts < MAX_ATTEMPTS
      && isRetryableCampaignEmailFailure(statusCode);
    const errorClass = error instanceof ResendConfigurationError
      ? "configuration"
      : statusCode === null ? "network_or_response" : "provider_http";
    const finishedAt = new Date();
    await db.transaction(async (transaction) => {
      const [updatedAttempt] = await transaction.update(emailCampaignAttemptsTable).set({
        status: "failed",
        errorClass,
        httpStatus: statusCode,
        finishedAt,
        updatedAt: finishedAt,
      }).where(and(
        eq(emailCampaignAttemptsTable.id, recipient.attemptId),
        eq(emailCampaignAttemptsTable.status, "sending"),
      )).returning({ id: emailCampaignAttemptsTable.id });
      if (!updatedAttempt) return;
      await transaction.update(emailCampaignRecipientsTable).set({
        status: retry ? "queued" : "failed",
        lastErrorClass: errorClass,
        lastErrorStatus: statusCode,
        nextAttemptAt: retry
          ? new Date(Date.now() + campaignRetryDelayMs(recipient.attempts))
          : null,
        processingStartedAt: null,
        updatedAt: finishedAt,
      }).where(and(
        eq(emailCampaignRecipientsTable.id, recipient.id),
        eq(emailCampaignRecipientsTable.status, "sending"),
      ));
    });
    logger.error({
      component: "email-campaign-worker",
      campaignId: recipient.campaignId,
      deliveryId: recipient.id,
      statusCode,
      retry,
    }, "Email campaign recipient delivery failed");
  }

  await refreshCampaignStatus(recipient.campaignId);
  return true;
}

export function startEmailCampaignWorker(logger: WorkerLogger) {
  if (!isCampaignDispatchEnabled(process.env)) {
    logger.info?.({ component: "email-campaign-worker" }, "Email campaign worker remains disabled");
    return () => undefined;
  }

  let active = false;
  const interval = setInterval(async () => {
    if (active || !isCampaignDispatchEnabled(process.env)) return;
    active = true;
    try {
      for (let index = 0; index < BATCH_SIZE; index += 1) {
        if (!await deliverOne(logger)) break;
      }
    } catch {
      logger.error({ component: "email-campaign-worker" }, "Email campaign worker batch failed");
    } finally {
      active = false;
    }
  }, POLL_INTERVAL_MS);
  interval.unref();
  logger.info?.({ component: "email-campaign-worker" }, "Email campaign worker started");
  return () => clearInterval(interval);
}
