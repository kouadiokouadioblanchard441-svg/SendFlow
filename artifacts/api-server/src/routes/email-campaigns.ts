import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ilike,
  ne,
  or,
  sql,
  adminAuditLogsTable,
  emailCampaignAttemptsTable,
  emailCampaignRetryRequestsTable,
  emailMarketingSuppressionsTable,
  usersTable,
  emailCampaignRecipientsTable,
  emailCampaignsTable,
  customerServiceSettingsTable,
} from "@workspace/db";
import { recordAdminAudit } from "../lib/admin-audit";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  normalizeSensitiveEmailForLookup,
} from "../lib/sensitive-data-crypto";
import { formatCustomerDisplayName } from "../lib/customer-profile-policy";
import { normalizeSensitiveNameForLookup } from "../lib/sensitive-data-crypto";
import {
  canManuallyRetryCampaignRecipient,
  getEmailCampaignConfiguration,
  isCampaignDispatchEnabled,
  isCampaignRecipientEligible,
} from "../lib/email-campaign-policy";
import { campaignAdminActionWithinLimit } from "../lib/email-campaign-provider-policy";
import { respondAdminAuthError } from "./admin";
import { z } from "zod";

const adminRoutes: IRouter = Router();
const recipientPageSize = 50;

async function hasCampaignActionCapacity(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  adminUserId: string,
  action: "queue" | "retry",
) {
  const limit = action === "queue" ? 10 : 20;
  const windowMs = action === "queue" ? 60 * 60_000 : 15 * 60_000;
  const auditAction = action === "queue" ? "queue_email_campaign" : "retry_email_campaign_recipient";
  await transaction.execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${adminUserId}), hashtext('sendflow-email-campaign-' || ${action}))
  `);
  const [recentActions] = await transaction.select({ value: count() })
    .from(adminAuditLogsTable)
    .where(and(
      eq(adminAuditLogsTable.adminUserId, adminUserId),
      eq(adminAuditLogsTable.action, auditAction),
      gte(adminAuditLogsTable.createdAt, new Date(Date.now() - windowMs)),
    ));
  return campaignAdminActionWithinLimit(Number(recentActions?.value ?? 0), limit);
}

const campaignInput = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyText: z.string().trim().min(1).max(20_000),
  audienceMode: z.enum(["all", "selected"]),
  userIds: z.array(z.string().trim().min(1).max(80)).max(5000),
}).strict().superRefine((value, context) => {
  if (new Set(value.userIds).size !== value.userIds.length) {
    context.addIssue({ code: "custom", path: ["userIds"], message: "Recipient list contains duplicates" });
  }
  if (value.audienceMode === "selected" && value.userIds.length === 0) {
    context.addIssue({ code: "custom", path: ["userIds"], message: "Select at least one recipient" });
  }
  if (value.audienceMode === "all" && value.userIds.length !== 0) {
    context.addIssue({ code: "custom", path: ["userIds"], message: "The all-users audience must not include explicit IDs" });
  }
});

type CampaignInput = z.infer<typeof campaignInput>;
type AudienceUser = {
  id: string;
  emailEncrypted: string | null;
  emailLookupHash: string | null;
  emailVerifiedAt: Date | null;
  status: string;
  emailMarketingConsentAt: Date | null;
  emailMarketingUnsubscribedAt: Date | null;
};

function dispatchEnabled() {
  return isCampaignDispatchEnabled(process.env);
}

async function customerServiceContactsReady() {
  const [contacts] = await db.select({
    phoneNumber: customerServiceSettingsTable.phoneNumber,
    whatsappNumber: customerServiceSettingsTable.whatsappNumber,
  }).from(customerServiceSettingsTable)
    .where(eq(customerServiceSettingsTable.id, "global"))
    .limit(1);
  return Boolean(contacts?.phoneNumber || contacts?.whatsappNumber);
}

function campaignStateCounts(rows: Array<{ status: string; value: number }>) {
  const countsByStatus = {
    draft: 0,
    queued: 0,
    sending: 0,
    accepted: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    if (row.status in countsByStatus) {
      countsByStatus[row.status as keyof typeof countsByStatus] = Number(row.value);
    }
  }
  return countsByStatus;
}

async function getCampaignSummaries(campaignIds?: string[]) {
  const campaigns = await db
    .select()
    .from(emailCampaignsTable)
    .where(campaignIds ? inArray(emailCampaignsTable.id, campaignIds) : undefined)
    .orderBy(desc(emailCampaignsTable.createdAt))
    .limit(100);
  if (campaigns.length === 0) return [];

  const recipientRows = await db
    .select({
      campaignId: emailCampaignRecipientsTable.campaignId,
      status: emailCampaignRecipientsTable.status,
      value: count(),
    })
    .from(emailCampaignRecipientsTable)
    .where(inArray(emailCampaignRecipientsTable.campaignId, campaigns.map((item) => item.id)))
    .groupBy(emailCampaignRecipientsTable.campaignId, emailCampaignRecipientsTable.status);
  const countsByCampaign = new Map<string, Array<{ status: string; value: number }>>();
  for (const row of recipientRows) {
    const group = countsByCampaign.get(row.campaignId) ?? [];
    group.push({ status: row.status, value: Number(row.value) });
    countsByCampaign.set(row.campaignId, group);
  }
  return campaigns.map((campaign) => ({
    id: campaign.id,
    subject: campaign.subject,
    bodyText: campaign.bodyText,
    audienceMode: campaign.audienceMode,
    status: campaign.status,
    recipientCount: campaign.recipientCount,
    unverifiedRecipientCount: campaign.unverifiedRecipientCount,
    counts: campaignStateCounts(countsByCampaign.get(campaign.id) ?? []),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    queuedAt: campaign.queuedAt,
    completedAt: campaign.completedAt,
  }));
}

async function resolveAudience(
  database: Pick<typeof db, "select">,
  input: CampaignInput,
): Promise<AudienceUser[] | null> {
  const where = input.audienceMode === "all"
    ? and(
        eq(usersTable.status, "active"),
        isNotNull(usersTable.emailEncrypted),
        isNotNull(usersTable.emailLookupHash),
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
        sql`NOT EXISTS (SELECT 1 FROM ${emailMarketingSuppressionsTable} WHERE ${emailMarketingSuppressionsTable.emailLookupHash} = ${usersTable.emailLookupHash})`,
      )
    : and(
        inArray(usersTable.id, input.userIds),
        eq(usersTable.status, "active"),
        isNotNull(usersTable.emailEncrypted),
        isNotNull(usersTable.emailLookupHash),
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
        sql`NOT EXISTS (SELECT 1 FROM ${emailMarketingSuppressionsTable} WHERE ${emailMarketingSuppressionsTable.emailLookupHash} = ${usersTable.emailLookupHash})`,
      );
  const recipients = await database.select({
    id: usersTable.id,
    emailEncrypted: usersTable.emailEncrypted,
    emailLookupHash: usersTable.emailLookupHash,
    emailVerifiedAt: usersTable.emailVerifiedAt,
    status: usersTable.status,
    emailMarketingConsentAt: usersTable.emailMarketingConsentAt,
    emailMarketingUnsubscribedAt: usersTable.emailMarketingUnsubscribedAt,
  }).from(usersTable).where(where);

  if (
    input.audienceMode === "selected"
    && recipients.length !== input.userIds.length
  ) {
    return null;
  }
  return recipients;
}

async function replaceDraftRecipients(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  campaignId: string,
  recipients: AudienceUser[],
) {
  await transaction.delete(emailCampaignRecipientsTable)
    .where(eq(emailCampaignRecipientsTable.campaignId, campaignId));
  if (recipients.length > 0) {
    await transaction.insert(emailCampaignRecipientsTable).values(
      recipients.map((recipient) => ({
        id: randomUUID(),
        campaignId,
        userId: recipient.id,
        status: "draft",
      })),
    );
  }
}

adminRoutes.get("/email-campaigns/recipients", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 254) : "";
  const rawPage = typeof req.query.page === "string" ? Number(req.query.page) : 1;
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 100_000) {
    res.status(400).json({ error: "Invalid recipient page" });
    return;
  }

  const baseFilters = [
    eq(usersTable.status, "active"),
    isNotNull(usersTable.emailEncrypted),
    isNotNull(usersTable.emailLookupHash),
    isNotNull(usersTable.emailVerifiedAt),
    isNotNull(usersTable.emailMarketingConsentAt),
    isNull(usersTable.emailMarketingUnsubscribedAt),
    sql`NOT EXISTS (SELECT 1 FROM ${emailMarketingSuppressionsTable} WHERE ${emailMarketingSuppressionsTable.emailLookupHash} = ${usersTable.emailLookupHash})`,
  ];
  if (search) {
    const normalizedEmail = normalizeSensitiveEmailForLookup(search);
    const emailHash = normalizedEmail.includes("@")
      ? createSensitiveDataLookupIndex(normalizedEmail, "user-email")
      : null;
    const normalizedName = normalizeSensitiveNameForLookup(search);
    const nameHash = normalizedName
      ? createSensitiveDataLookupIndex(normalizedName, "user-name")
      : null;
    const searchFilter = or(
      emailHash ? eq(usersTable.emailLookupHash, emailHash) : undefined,
      nameHash ? eq(usersTable.displayNameLookupHash, nameHash) : undefined,
    );
    if (searchFilter) baseFilters.push(searchFilter);
  }

  try {
    const filter = and(...baseFilters);
    const [items, total, allEligibleCount, allWithEmailCount] = await Promise.all([
      db.select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        emailEncrypted: usersTable.emailEncrypted,
        status: usersTable.status,
        emailVerifiedAt: usersTable.emailVerifiedAt,
      }).from(usersTable)
        .where(filter)
        .orderBy(desc(usersTable.createdAt))
        .limit(recipientPageSize)
        .offset((rawPage - 1) * recipientPageSize),
      db.select({ value: count() }).from(usersTable).where(filter),
      db.select({ value: count() }).from(usersTable).where(and(
        eq(usersTable.status, "active"),
        isNotNull(usersTable.emailEncrypted),
        isNotNull(usersTable.emailLookupHash),
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
        sql`NOT EXISTS (SELECT 1 FROM ${emailMarketingSuppressionsTable} WHERE ${emailMarketingSuppressionsTable.emailLookupHash} = ${usersTable.emailLookupHash})`,
      )),
      db.select({ value: count() }).from(usersTable).where(and(
        ne(usersTable.status, "deleted"),
        isNotNull(usersTable.emailEncrypted),
      )),
    ]);

    await recordAdminAudit({
      adminUserId,
      action: "view_email_campaigns",
      resourceType: "email_campaign",
      resourceId: "recipient-search",
    });

    res.json({
      items: items.flatMap((item) => {
        const email = decryptSensitiveDataIfEncrypted(item.emailEncrypted, "user-email");
        if (!email) return [];
        return [{
          userId: item.id,
          displayName: formatCustomerDisplayName(
            decryptSensitiveDataIfEncrypted(item.displayName, "user-name"),
          ),
          email,
          accountStatus: item.status,
          emailVerifiedAt: item.emailVerifiedAt,
        }];
      }),
      page: rawPage,
      pageSize: recipientPageSize,
      total: Number(total[0]?.value ?? 0),
      allRecipientCount: Number(allEligibleCount[0]?.value ?? 0),
      allIneligibleRecipientCount: Math.max(
        0,
        Number(allWithEmailCount[0]?.value ?? 0) - Number(allEligibleCount[0]?.value ?? 0),
      ),
    });
  } catch (error) {
    req.log.error({ err: error }, "Email campaign recipient lookup failed");
    res.status(503).json({ error: "La liste des destinataires est indisponible." });
  }
});

adminRoutes.get("/email-campaigns/history", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const rawSearch = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
  const page = typeof req.query.page === "string" ? Number(req.query.page) : 1;
  const pageSize = typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : 25;
  const statuses = new Set(["queued", "sending", "accepted", "delivered", "bounced", "complained", "failed", "cancelled"]);
  if (
    rawSearch.length > 254
    || (rawStatus !== undefined && !statuses.has(rawStatus))
    || (campaignId !== undefined && (campaignId.length < 1 || campaignId.length > 80))
    || !Number.isInteger(page) || page < 1 || page > 100_000
    || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
  ) {
    res.status(400).json({ error: "Invalid delivery history filters" });
    return;
  }

  const escapedSearch = rawSearch.replace(/[\\%_]/g, "\\$&");
  const emailHash = rawSearch.includes("@")
    ? createSensitiveDataLookupIndex(normalizeSensitiveEmailForLookup(rawSearch), "user-email")
    : null;
  const nameHash = normalizeSensitiveNameForLookup(rawSearch)
    ? createSensitiveDataLookupIndex(normalizeSensitiveNameForLookup(rawSearch), "user-name")
    : null;
  const commonFilters = [
    ne(emailCampaignRecipientsTable.status, "draft"),
    campaignId ? eq(emailCampaignRecipientsTable.campaignId, campaignId) : undefined,
    rawSearch ? or(
      ilike(emailCampaignsTable.subject, `%${escapedSearch}%`),
      emailHash ? eq(usersTable.emailLookupHash, emailHash) : undefined,
      nameHash ? eq(usersTable.displayNameLookupHash, nameHash) : undefined,
      ilike(emailCampaignRecipientsTable.providerMessageId, `%${escapedSearch}%`),
    ) : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  const filters = rawStatus
    ? [...commonFilters, eq(emailCampaignRecipientsTable.status, rawStatus)]
    : commonFilters;

  try {
    const [rows, totalRows, countRows] = await Promise.all([
      db.select({
        recipientId: emailCampaignRecipientsTable.id,
        campaignId: emailCampaignRecipientsTable.campaignId,
        subject: emailCampaignsTable.subject,
        emailSnapshotEncrypted: emailCampaignRecipientsTable.emailSnapshotEncrypted,
        currentEmailEncrypted: usersTable.emailEncrypted,
        status: emailCampaignRecipientsTable.status,
        createdAt: emailCampaignRecipientsTable.createdAt,
        acceptedAt: emailCampaignRecipientsTable.acceptedAt,
        attempts: emailCampaignRecipientsTable.attempts,
        manualRetries: emailCampaignRecipientsTable.manualRetries,
        lastErrorClass: emailCampaignRecipientsTable.lastErrorClass,
        lastErrorStatus: emailCampaignRecipientsTable.lastErrorStatus,
        providerMessageId: emailCampaignRecipientsTable.providerMessageId,
        providerUpdatedAt: emailCampaignRecipientsTable.providerUpdatedAt,
      }).from(emailCampaignRecipientsTable)
        .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
        .leftJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
        .where(and(...filters))
        .orderBy(desc(emailCampaignRecipientsTable.updatedAt), desc(emailCampaignRecipientsTable.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ value: count() })
        .from(emailCampaignRecipientsTable)
        .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
        .leftJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
        .where(and(...filters)),
      db.select({
        status: emailCampaignRecipientsTable.status,
        value: count(),
      }).from(emailCampaignRecipientsTable)
        .innerJoin(emailCampaignsTable, eq(emailCampaignsTable.id, emailCampaignRecipientsTable.campaignId))
        .leftJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
        .where(and(...commonFilters))
        .groupBy(emailCampaignRecipientsTable.status),
    ]);

    const recipientIds = rows.map((row) => row.recipientId);
    const attempts = recipientIds.length
      ? await db.select({
          recipientId: emailCampaignAttemptsTable.recipientId,
          attemptNumber: emailCampaignAttemptsTable.attemptNumber,
          status: emailCampaignAttemptsTable.status,
          startedAt: emailCampaignAttemptsTable.startedAt,
          finishedAt: emailCampaignAttemptsTable.finishedAt,
          errorClass: emailCampaignAttemptsTable.errorClass,
          httpStatus: emailCampaignAttemptsTable.httpStatus,
          providerMessageId: emailCampaignAttemptsTable.providerMessageId,
          providerUpdatedAt: emailCampaignAttemptsTable.providerUpdatedAt,
          emailSnapshotEncrypted: emailCampaignAttemptsTable.emailSnapshotEncrypted,
        }).from(emailCampaignAttemptsTable)
          .where(inArray(emailCampaignAttemptsTable.recipientId, recipientIds))
          .orderBy(asc(emailCampaignAttemptsTable.createdAt), asc(emailCampaignAttemptsTable.attemptNumber))
      : [];
    const attemptsByRecipient = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const group = attemptsByRecipient.get(attempt.recipientId) ?? [];
      group.push(attempt);
      attemptsByRecipient.set(attempt.recipientId, group);
    }
    const counts = {
      queued: 0,
      sending: 0,
      accepted: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const row of countRows) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.value);
    }

    const response = {
      items: rows.map((row) => {
        const email = decryptSensitiveDataIfEncrypted(
          row.emailSnapshotEncrypted ?? row.currentEmailEncrypted,
          "user-email",
        );
        const recipientAttempts = attemptsByRecipient.get(row.recipientId) ?? [];
        return {
          recipientId: row.recipientId,
          campaignId: row.campaignId,
          subject: row.subject,
          email,
          addressSource: row.emailSnapshotEncrypted
            ? "send_snapshot"
            : row.currentEmailEncrypted ? "current_account" : "unavailable",
          status: row.status,
          createdAt: row.createdAt.toISOString(),
          acceptedAt: row.acceptedAt?.toISOString() ?? null,
          attemptCount: Math.max(recipientAttempts.length, row.attempts),
          manualRetries: row.manualRetries,
          lastErrorClass: row.lastErrorClass,
          lastErrorStatus: row.lastErrorStatus,
          providerMessageId: row.providerMessageId,
          providerUpdatedAt: row.providerUpdatedAt?.toISOString() ?? null,
          attempts: recipientAttempts.map((attempt) => ({
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            email: decryptSensitiveDataIfEncrypted(attempt.emailSnapshotEncrypted, "user-email"),
            addressSource: attempt.emailSnapshotEncrypted ? "send_snapshot" : "unavailable",
            startedAt: attempt.startedAt.toISOString(),
            finishedAt: attempt.finishedAt?.toISOString() ?? null,
            errorClass: attempt.errorClass,
            httpStatus: attempt.httpStatus,
            providerMessageId: attempt.providerMessageId,
            providerUpdatedAt: attempt.providerUpdatedAt?.toISOString() ?? null,
          })),
        };
      }),
      page,
      pageSize,
      total: Number(totalRows[0]?.value ?? 0),
      counts,
    };
    await recordAdminAudit({
      adminUserId,
      action: "view_email_campaigns",
      resourceType: "email_campaign",
      resourceId: "delivery-history",
    });
    res.setHeader("Cache-Control", "no-store, private");
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Email campaign delivery history lookup failed");
    res.status(503).json({ error: "L’historique des envois est indisponible." });
  }
});

adminRoutes.get("/email-campaigns", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  try {
    const items = await getCampaignSummaries();
    await recordAdminAudit({
      adminUserId,
      action: "view_email_campaigns",
      resourceType: "email_campaign",
      resourceId: "campaign-list",
    });
    res.json({ items, sendingEnabled: dispatchEnabled() && await customerServiceContactsReady() });
  } catch (error) {
    req.log.error({ err: error }, "Email campaign list lookup failed");
    res.status(503).json({ error: "L’historique des campagnes est indisponible." });
  }
});

adminRoutes.get("/email-campaigns/settings", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "read");
  if (!adminUserId) return;
  try {
    const settings = getEmailCampaignConfiguration();
    const contactsReady = await customerServiceContactsReady();
    await recordAdminAudit({
      adminUserId,
      action: "view_email_campaigns",
      resourceType: "email_campaign",
      resourceId: "settings",
    });
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ ...settings, sendingEnabled: settings.sendingEnabled && contactsReady });
  } catch {
    req.log.error("Email campaign settings lookup failed");
    res.status(503).json({ error: "Les paramètres de campagne sont indisponibles." });
  }
});

adminRoutes.get("/email-campaigns/:campaignId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  const campaignId = req.params.campaignId;
  try {
    const [campaign] = await db.select().from(emailCampaignsTable)
      .where(eq(emailCampaignsTable.id, campaignId)).limit(1);
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    const [summary] = await getCampaignSummaries([campaignId]);
    const recipients = await db.select({ userId: emailCampaignRecipientsTable.userId })
      .from(emailCampaignRecipientsTable)
      .where(eq(emailCampaignRecipientsTable.campaignId, campaignId));
    await recordAdminAudit({
      adminUserId,
      action: "view_email_campaign_recipients",
      resourceType: "email_campaign",
      resourceId: campaignId,
    });
    res.json({ campaign: summary, recipientUserIds: recipients.map((item) => item.userId) });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign detail lookup failed");
    res.status(503).json({ error: "Les détails de la campagne sont indisponibles." });
  }
});

adminRoutes.post("/email-campaigns", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  const parsed = campaignInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez l’objet, le message et les destinataires sélectionnés." });
    return;
  }

  const campaignId = randomUUID();
  try {
    const result = await db.transaction(async (transaction) => {
      const recipients = await resolveAudience(transaction, parsed.data);
      if (!recipients || recipients.length === 0) return null;
      const unverifiedCount = recipients.filter((recipient) => !recipient.emailVerifiedAt).length;
      await transaction.insert(emailCampaignsTable).values({
        id: campaignId,
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        audienceMode: parsed.data.audienceMode,
        status: "draft",
        recipientCount: recipients.length,
        unverifiedRecipientCount: unverifiedCount,
        createdBy: adminUserId,
      });
      await replaceDraftRecipients(transaction, campaignId, recipients);
      await recordAdminAudit({
        adminUserId,
        action: "create_email_campaign",
        resourceType: "email_campaign",
        resourceId: campaignId,
      }, transaction);
      return { recipientCount: recipients.length, unverifiedCount };
    });
    if (!result) {
      res.status(400).json({ error: "La sélection contient une adresse absente ou un compte supprimé, ou ne contient aucun destinataire." });
      return;
    }
    const [campaign] = await getCampaignSummaries([campaignId]);
    res.status(201).json({ campaign });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign draft creation failed");
    res.status(503).json({ error: "Le brouillon de campagne n’a pas pu être enregistré." });
  }
});

adminRoutes.patch("/email-campaigns/:campaignId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  const parsed = campaignInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Vérifiez l’objet, le message et les destinataires sélectionnés." });
    return;
  }
  const campaignId = req.params.campaignId;
  try {
    const updated = await db.transaction(async (transaction) => {
      const [existing] = await transaction.select({ id: emailCampaignsTable.id, status: emailCampaignsTable.status })
        .from(emailCampaignsTable)
        .where(eq(emailCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);
      if (!existing) return "missing" as const;
      if (existing.status !== "draft") return "conflict" as const;
      const recipients = await resolveAudience(transaction, parsed.data);
      if (!recipients || recipients.length === 0) return "invalid-audience" as const;
      await transaction.update(emailCampaignsTable).set({
        subject: parsed.data.subject,
        bodyText: parsed.data.bodyText,
        audienceMode: parsed.data.audienceMode,
        recipientCount: recipients.length,
        unverifiedRecipientCount: recipients.filter((recipient) => !recipient.emailVerifiedAt).length,
        updatedAt: new Date(),
      }).where(eq(emailCampaignsTable.id, campaignId));
      await replaceDraftRecipients(transaction, campaignId, recipients);
      await recordAdminAudit({
        adminUserId,
        action: "update_email_campaign",
        resourceType: "email_campaign",
        resourceId: campaignId,
      }, transaction);
      return "updated" as const;
    });
    if (updated === "missing") {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (updated === "conflict") {
      res.status(409).json({ error: "Only an unsent draft can be edited" });
      return;
    }
    if (updated === "invalid-audience") {
      res.status(400).json({ error: "La sélection contient une adresse absente ou un compte supprimé, ou ne contient aucun destinataire." });
      return;
    }
    const [campaign] = await getCampaignSummaries([campaignId]);
    res.json({ campaign });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign draft update failed");
    res.status(503).json({ error: "Le brouillon de campagne n’a pas pu être modifié." });
  }
});

adminRoutes.post("/email-campaigns/:campaignId/send", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!dispatchEnabled()) {
    res.status(503).json({ error: "L’envoi des campagnes est désactivé ou n’est pas configuré en production." });
    return;
  }
  const campaignId = req.params.campaignId;
  try {
    if (!await customerServiceContactsReady()) {
      res.status(503).json({ error: "Configurez au moins un numéro du service client avant de mettre une campagne en file." });
      return;
    }
    const result = await db.transaction(async (transaction) => {
      const [campaign] = await transaction.select()
        .from(emailCampaignsTable)
        .where(eq(emailCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);
      if (!campaign) return "missing" as const;
      if (campaign.status !== "draft" || campaign.recipientCount < 1) return "conflict" as const;
      if (!await hasCampaignActionCapacity(transaction, adminUserId, "queue")) {
        return "rate-limited" as const;
      }
      const [eligibleCount] = await transaction.select({ value: count() })
        .from(emailCampaignRecipientsTable)
        .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
        .where(and(
          eq(emailCampaignRecipientsTable.campaignId, campaignId),
          eq(emailCampaignRecipientsTable.status, "draft"),
          eq(usersTable.status, "active"),
          isNotNull(usersTable.emailEncrypted),
          isNotNull(usersTable.emailLookupHash),
          isNotNull(usersTable.emailVerifiedAt),
          isNotNull(usersTable.emailMarketingConsentAt),
          isNull(usersTable.emailMarketingUnsubscribedAt),
          sql`NOT EXISTS (SELECT 1 FROM ${emailMarketingSuppressionsTable} WHERE ${emailMarketingSuppressionsTable.emailLookupHash} = ${usersTable.emailLookupHash})`,
        ));
      if (Number(eligibleCount?.value ?? 0) === 0) return "no-eligible" as const;

      const now = new Date();
      await transaction.execute(sql`
        UPDATE sf_email_campaign_recipients AS recipients
        SET status = 'queued',
            email_snapshot_encrypted = users.email_encrypted,
            email_snapshot_lookup_hash = users.email_lookup_hash,
            next_attempt_at = ${now},
            last_error_class = NULL,
            last_error_status = NULL,
            updated_at = ${now}
        FROM sf_users AS users
        WHERE recipients.campaign_id = ${campaignId}
          AND recipients.status = 'draft'
          AND recipients.user_id = users.id
          AND users.status = 'active'
          AND users.email_encrypted IS NOT NULL
          AND users.email_lookup_hash IS NOT NULL
          AND users.email_verified_at IS NOT NULL
          AND users.email_marketing_consent_at IS NOT NULL
          AND users.email_marketing_unsubscribed_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM sf_email_marketing_suppressions AS suppressions
            WHERE suppressions.email_lookup_hash = users.email_lookup_hash
          )
      `);
      await transaction.execute(sql`
        UPDATE sf_email_campaign_recipients AS recipients
        SET status = 'cancelled',
            last_error_class = 'recipient_not_eligible',
            next_attempt_at = NULL,
            updated_at = ${now}
        FROM sf_users AS users
        WHERE recipients.campaign_id = ${campaignId}
          AND recipients.status = 'draft'
          AND recipients.user_id = users.id
          AND (
            users.status <> 'active'
            OR users.email_encrypted IS NULL
            OR users.email_lookup_hash IS NULL
            OR users.email_verified_at IS NULL
            OR users.email_marketing_consent_at IS NULL
            OR users.email_marketing_unsubscribed_at IS NOT NULL
            OR EXISTS (
              SELECT 1 FROM sf_email_marketing_suppressions AS suppressions
              WHERE suppressions.email_lookup_hash = users.email_lookup_hash
            )
          )
      `);
      await transaction.update(emailCampaignsTable).set({
        status: "queued",
        queuedAt: now,
        updatedAt: now,
      }).where(eq(emailCampaignsTable.id, campaignId));
      await recordAdminAudit({
        adminUserId,
        action: "queue_email_campaign",
        resourceType: "email_campaign",
        resourceId: campaignId,
      }, transaction);
      return "queued" as const;
    });
    if (result === "missing") {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (result === "conflict") {
      res.status(409).json({ error: "Campaign is not an editable draft" });
      return;
    }
    if (result === "rate-limited") {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ error: "La limite de mises en file pour cet administrateur est atteinte. Réessayez plus tard." });
      return;
    }
    if (result === "no-eligible") {
      res.status(409).json({ error: "Aucun destinataire ne conserve actuellement une adresse vérifiée et un consentement actif." });
      return;
    }
    const [campaign] = await getCampaignSummaries([campaignId]);
    res.json({ campaign });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign queue request failed");
    res.status(503).json({ error: "La campagne n’a pas pu être mise en file d’envoi." });
  }
});

adminRoutes.post("/email-campaigns/:campaignId/cancel", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  const campaignId = req.params.campaignId;
  try {
    const result = await db.transaction(async (transaction) => {
      const [campaign] = await transaction.select({ status: emailCampaignsTable.status })
        .from(emailCampaignsTable)
        .where(eq(emailCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);
      if (!campaign) return "missing" as const;
      if (campaign.status !== "queued") return "conflict" as const;
      await transaction.update(emailCampaignsTable).set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(emailCampaignsTable.id, campaignId));
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(and(
        eq(emailCampaignRecipientsTable.campaignId, campaignId),
        eq(emailCampaignRecipientsTable.status, "queued"),
      ));
      await recordAdminAudit({
        adminUserId,
        action: "cancel_email_campaign",
        resourceType: "email_campaign",
        resourceId: campaignId,
      }, transaction);
      return "cancelled" as const;
    });
    if (result === "missing") {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (result === "conflict") {
      res.status(409).json({ error: "Campaign delivery has started or already completed" });
      return;
    }
    const [campaign] = await getCampaignSummaries([campaignId]);
    res.json({ campaign });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign cancel request failed");
    res.status(503).json({ error: "La campagne n’a pas pu être annulée." });
  }
});

adminRoutes.post(
  "/email-campaigns/:campaignId/recipients/:recipientId/retry",
  async (req, res): Promise<void> => {
    const adminUserId = respondAdminAuthError(req, res, "mutate");
    if (!adminUserId) return;
    if (!dispatchEnabled()) {
      res.status(503).json({ error: "La relance est indisponible tant que l’envoi n’est pas configuré." });
      return;
    }

    const idempotencyKey = req.get("Idempotency-Key")?.trim() ?? "";
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      res.status(400).json({ error: "Idempotency-Key is invalid" });
      return;
    }
    const { campaignId, recipientId } = req.params;

    try {
      const result = await db.transaction(async (transaction) => {
        // Every campaign mutation and worker claim locks campaign before recipient.
        const [campaign] = await transaction.select({
          id: emailCampaignsTable.id,
          status: emailCampaignsTable.status,
        }).from(emailCampaignsTable)
          .where(eq(emailCampaignsTable.id, campaignId))
          .for("update")
          .limit(1);
        if (!campaign) return "missing" as const;
        if (campaign.status === "cancelled") return "campaign-conflict" as const;

        // Recheck after the campaign lock so concurrent duplicate keys replay
        // the committed request rather than racing into a 409 on recipient state.
        const [previousRequest] = await transaction.select()
          .from(emailCampaignRetryRequestsTable)
          .where(eq(emailCampaignRetryRequestsTable.idempotencyKey, idempotencyKey))
          .limit(1);
        if (previousRequest) {
          return previousRequest.recipientId === recipientId
            && previousRequest.adminUserId === adminUserId
            ? "replayed" as const
            : "idempotency-conflict" as const;
        }
        if (!await hasCampaignActionCapacity(transaction, adminUserId, "retry")) {
          return "rate-limited" as const;
        }

        const [recipient] = await transaction.select({
          id: emailCampaignRecipientsTable.id,
          status: emailCampaignRecipientsTable.status,
          attempts: emailCampaignRecipientsTable.attempts,
          manualRetries: emailCampaignRecipientsTable.manualRetries,
          lastErrorClass: emailCampaignRecipientsTable.lastErrorClass,
          accountStatus: usersTable.status,
          emailEncrypted: usersTable.emailEncrypted,
          emailVerifiedAt: usersTable.emailVerifiedAt,
          emailMarketingConsentAt: usersTable.emailMarketingConsentAt,
          emailMarketingUnsubscribedAt: usersTable.emailMarketingUnsubscribedAt,
          emailLookupHash: usersTable.emailLookupHash,
          emailSnapshotEncrypted: emailCampaignRecipientsTable.emailSnapshotEncrypted,
          emailSnapshotLookupHash: emailCampaignRecipientsTable.emailSnapshotLookupHash,
          providerSuppressed: sql<boolean>`EXISTS (
            SELECT 1 FROM sf_email_marketing_suppressions
            WHERE sf_email_marketing_suppressions.email_lookup_hash = ${usersTable.emailLookupHash}
          )`,
        }).from(emailCampaignRecipientsTable)
          .innerJoin(usersTable, eq(usersTable.id, emailCampaignRecipientsTable.userId))
          .where(and(
            eq(emailCampaignRecipientsTable.id, recipientId),
            eq(emailCampaignRecipientsTable.campaignId, campaignId),
          ))
          .for("update")
          .limit(1);
        if (!recipient) return "missing" as const;
        const savedEmail = decryptSensitiveDataIfEncrypted(
          recipient.emailSnapshotEncrypted ?? recipient.emailEncrypted,
          "user-email",
        );
        const emailSnapshotLookupHash = recipient.emailSnapshotLookupHash
          ?? (savedEmail
            ? createSensitiveDataLookupIndex(normalizeSensitiveEmailForLookup(savedEmail), "user-email")
            : null);
        if (!canManuallyRetryCampaignRecipient({
          status: recipient.status,
          manualRetries: recipient.manualRetries,
          lastErrorClass: recipient.lastErrorClass,
          recipient: {
            ...recipient,
            emailSnapshotLookupHash,
            providerSuppressed: recipient.providerSuppressed,
          },
        })) return "recipient-conflict" as const;

        const now = new Date();
        const [insertedRequest] = await transaction.insert(emailCampaignRetryRequestsTable)
          .values({ idempotencyKey, recipientId, adminUserId, createdAt: now })
          .onConflictDoNothing()
          .returning({ idempotencyKey: emailCampaignRetryRequestsTable.idempotencyKey });
        if (!insertedRequest) {
          const [existingRequest] = await transaction.select()
            .from(emailCampaignRetryRequestsTable)
            .where(eq(emailCampaignRetryRequestsTable.idempotencyKey, idempotencyKey))
            .limit(1);
          return existingRequest?.recipientId === recipientId
            && existingRequest.adminUserId === adminUserId
            ? "replayed" as const
            : "idempotency-conflict" as const;
        }

        await transaction.update(emailCampaignRecipientsTable).set({
          status: "queued",
          attempts: 0,
          manualRetries: recipient.manualRetries + 1,
          emailSnapshotEncrypted: recipient.emailSnapshotEncrypted ?? recipient.emailEncrypted,
          emailSnapshotLookupHash,
          nextAttemptAt: now,
          processingStartedAt: null,
          updatedAt: now,
        }).where(and(
          eq(emailCampaignRecipientsTable.id, recipientId),
          eq(emailCampaignRecipientsTable.status, "failed"),
        ));
        await transaction.update(emailCampaignsTable).set({
          status: "queued",
          completedAt: null,
          updatedAt: now,
        }).where(eq(emailCampaignsTable.id, campaignId));
        await recordAdminAudit({
          adminUserId,
          action: "retry_email_campaign_recipient",
          resourceType: "email_campaign",
          resourceId: recipientId,
        }, transaction);
        return "queued" as const;
      });

      if (result === "missing") {
        res.status(404).json({ error: "Campaign recipient not found" });
        return;
      }
      if (result === "campaign-conflict" || result === "recipient-conflict" || result === "idempotency-conflict") {
        res.status(409).json({ error: "Cette adresse n’est plus relançable, n’est pas éligible ou a atteint sa limite de relances." });
        return;
      }
      if (result === "rate-limited") {
        res.setHeader("Retry-After", "900");
        res.status(429).json({ error: "La limite de relances pour cet administrateur est atteinte. Réessayez plus tard." });
        return;
      }
      if (result === "replayed") {
        const [current] = await db.select({ status: emailCampaignRecipientsTable.status })
          .from(emailCampaignRecipientsTable)
          .where(and(
            eq(emailCampaignRecipientsTable.id, recipientId),
            eq(emailCampaignRecipientsTable.campaignId, campaignId),
          ))
          .limit(1);
        if (!current) {
          res.status(404).json({ error: "Campaign recipient not found" });
          return;
        }
        res.json({ recipientId, status: current.status, replayed: true });
        return;
      }
      res.json({ recipientId, status: "queued", replayed: false });
    } catch (error) {
      req.log.error({ err: error, campaignId, recipientId }, "Email campaign recipient retry could not be recorded");
      res.status(503).json({ error: "La relance n’a pas pu être enregistrée." });
    }
  },
);

adminRoutes.delete("/email-campaigns/:campaignId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  const campaignId = req.params.campaignId;
  try {
    const deleted = await db.transaction(async (transaction) => {
      const [campaign] = await transaction.select({ status: emailCampaignsTable.status })
        .from(emailCampaignsTable)
        .where(eq(emailCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);
      if (!campaign) return "missing" as const;
      if (campaign.status !== "draft") return "conflict" as const;
      await transaction.delete(emailCampaignsTable).where(eq(emailCampaignsTable.id, campaignId));
      await recordAdminAudit({
        adminUserId,
        action: "delete_email_campaign",
        resourceType: "email_campaign",
        resourceId: campaignId,
      }, transaction);
      return "deleted" as const;
    });
    if (deleted === "missing") {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }
    if (deleted === "conflict") {
      res.status(409).json({ error: "Only an unsent draft can be deleted" });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign draft deletion failed");
    res.status(503).json({ error: "Le brouillon de campagne n’a pas pu être supprimé." });
  }
});

export default adminRoutes;
