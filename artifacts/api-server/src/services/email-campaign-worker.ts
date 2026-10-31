import {
  and,
  asc,
  db,
  emailCampaignRecipientsTable,
  emailCampaignsTable,
  eq,
  gt,
  isNull,
  inArray,
  count,
  lte,
  or,
  usersTable,
} from "@workspace/db";
import { decryptSensitiveDataIfEncrypted } from "../lib/sensitive-data-crypto";
import {
  campaignRetryDelayMs,
  isCampaignDispatchEnabled,
  isRetryableCampaignEmailFailure,
} from "../lib/email-campaign-policy";
import { ResendConfigurationError, ResendDeliveryError, sendResendEmail } from "../lib/resend-email";

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

function renderPlainTextEmail(bodyText: string) {
  const escaped = escapeHtml(bodyText);
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${escaped}</div>`;
}

async function refreshCampaignStatus(campaignId: string) {
  const statuses = await db.select({
    status: emailCampaignRecipientsTable.status,
    value: count(),
  }).from(emailCampaignRecipientsTable)
    .where(eq(emailCampaignRecipientsTable.campaignId, campaignId))
    .groupBy(emailCampaignRecipientsTable.status);
  const pending = statuses.some((item) => item.status === "queued" || item.status === "sending");
  if (pending) {
    await db.update(emailCampaignsTable).set({
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
  await db.update(emailCampaignsTable).set({
    status: finalStatus,
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(emailCampaignsTable.id, campaignId),
    ne(emailCampaignsTable.status, "cancelled"),
  ));
}

async function claimNextRecipient() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return db.transaction(async (transaction) => {
    const [recipient] = await transaction.select({
      id: emailCampaignRecipientsTable.id,
      campaignId: emailCampaignsTable.id,
      userId: usersTable.id,
      attempts: emailCampaignRecipientsTable.attempts,
      subject: emailCampaignsTable.subject,
      bodyText: emailCampaignsTable.bodyText,
      emailEncrypted: usersTable.emailEncrypted,
      accountStatus: usersTable.status,
    }).from(emailCampaignRecipientsTable)
      .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
      .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
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
      .for("update", { of: emailCampaignRecipientsTable, skipLocked: true });

    if (recipient) {
      const attempts = recipient.attempts + 1;
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "sending",
        attempts,
        processingStartedAt: now,
        updatedAt: now,
      }).where(and(
        eq(emailCampaignRecipientsTable.id, recipient.id),
        eq(emailCampaignRecipientsTable.status, "queued"),
      ));
      await transaction.update(emailCampaignsTable).set({
        status: "sending",
        updatedAt: now,
      }).where(and(
        eq(emailCampaignsTable.id, recipient.campaignId),
        eq(emailCampaignsTable.status, "queued"),
      ));
      return { ...recipient, attempts };
    }

    const [stale] = await transaction.select({
      id: emailCampaignRecipientsTable.id,
      campaignId: emailCampaignsTable.id,
      userId: usersTable.id,
      attempts: emailCampaignRecipientsTable.attempts,
      subject: emailCampaignsTable.subject,
      bodyText: emailCampaignsTable.bodyText,
      processingStartedAt: emailCampaignRecipientsTable.processingStartedAt,
      emailEncrypted: usersTable.emailEncrypted,
      accountStatus: usersTable.status,
    }).from(emailCampaignRecipientsTable)
      .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
      .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
      .where(and(
        eq(emailCampaignsTable.status, "sending"),
        eq(emailCampaignRecipientsTable.status, "sending"),
        gt(emailCampaignRecipientsTable.processingStartedAt, new Date(0)),
      ))
      .orderBy(asc(emailCampaignRecipientsTable.processingStartedAt))
      .limit(1)
      .for("update", { of: emailCampaignRecipientsTable, skipLocked: true });

    if (!stale || !stale.processingStartedAt || stale.processingStartedAt > staleBefore) return null;
    const attempts = stale.attempts + 1;
    await transaction.update(emailCampaignRecipientsTable).set({
      attempts,
      processingStartedAt: now,
      updatedAt: now,
    }).where(eq(emailCampaignRecipientsTable.id, stale.id));
    return { ...stale, attempts };
  });
}

async function deliverOne(logger: WorkerLogger) {
  const recipient = await claimNextRecipient();
  if (!recipient) return false;
  const now = new Date();

  if (recipient.accountStatus === "deleted" || !recipient.emailEncrypted) {
    await db.update(emailCampaignRecipientsTable).set({
      status: "cancelled",
      lastErrorClass: "recipient_unavailable",
      processingStartedAt: null,
      updatedAt: now,
    }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
    await refreshCampaignStatus(recipient.campaignId);
    return true;
  }

  const email = decryptSensitiveDataIfEncrypted(recipient.emailEncrypted, "user-email");
  if (!email) {
    await db.update(emailCampaignRecipientsTable).set({
      status: "failed",
      lastErrorClass: "recipient_address_unavailable",
      processingStartedAt: null,
      updatedAt: now,
    }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
    await refreshCampaignStatus(recipient.campaignId);
    return true;
  }

  try {
    const sent = await sendResendEmail({
      to: email,
      subject: recipient.subject,
      text: recipient.bodyText,
      html: renderPlainTextEmail(recipient.bodyText),
    }, {
      idempotencyKey: `sf-campaign-${recipient.id}`,
    });
    await db.update(emailCampaignRecipientsTable).set({
      status: "accepted",
      providerMessageId: sent.messageId,
      acceptedAt: new Date(),
      processingStartedAt: null,
      nextAttemptAt: null,
      lastErrorClass: null,
      lastErrorStatus: null,
      updatedAt: new Date(),
    }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
  } catch (error) {
    const statusCode = error instanceof ResendDeliveryError ? error.statusCode : null;
    const retry = !(error instanceof ResendConfigurationError)
      && recipient.attempts < MAX_ATTEMPTS
      && isRetryableCampaignEmailFailure(statusCode);
    await db.update(emailCampaignRecipientsTable).set({
      status: retry ? "queued" : "failed",
      lastErrorClass: error instanceof ResendConfigurationError
        ? "configuration"
        : statusCode === null ? "network_or_response" : "provider_http",
      lastErrorStatus: statusCode,
      nextAttemptAt: retry
        ? new Date(Date.now() + campaignRetryDelayMs(recipient.attempts))
        : null,
      processingStartedAt: null,
      updatedAt: new Date(),
    }).where(eq(emailCampaignRecipientsTable.id, recipient.id));
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
