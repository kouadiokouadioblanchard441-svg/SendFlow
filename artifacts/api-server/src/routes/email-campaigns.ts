import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  and,
  asc,
  count,
  db,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  emailCampaignAttemptsTable,
  emailCampaignRetryRequestsTable,
  usersTable,
  emailCampaignRecipientsTable,
  emailCampaignsTable,
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
  isCampaignDispatchEnabled,
  isCampaignRecipientEligible,
} from "../lib/email-campaign-policy";
import { respondAdminAuthError } from "./admin";
import { z } from "zod";

const adminRoutes: IRouter = Router();
const recipientPageSize = 50;

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
  emailVerifiedAt: Date | null;
  status: string;
  emailMarketingConsentAt: Date | null;
  emailMarketingUnsubscribedAt: Date | null;
};

function dispatchEnabled() {
  return isCampaignDispatchEnabled(process.env);
}

function campaignStateCounts(rows: Array<{ status: string; value: number }>) {
  const countsByStatus = {
    draft: 0,
    queued: 0,
    sending: 0,
    accepted: 0,
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
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
      )
    : and(
        inArray(usersTable.id, input.userIds),
        eq(usersTable.status, "active"),
        isNotNull(usersTable.emailEncrypted),
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
      );
  const recipients = await database.select({
    id: usersTable.id,
    emailEncrypted: usersTable.emailEncrypted,
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
    isNotNull(usersTable.emailVerifiedAt),
    isNotNull(usersTable.emailMarketingConsentAt),
    isNull(usersTable.emailMarketingUnsubscribedAt),
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
        isNotNull(usersTable.emailVerifiedAt),
        isNotNull(usersTable.emailMarketingConsentAt),
        isNull(usersTable.emailMarketingUnsubscribedAt),
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
    res.json({ items, sendingEnabled: dispatchEnabled() });
  } catch (error) {
    req.log.error({ err: error }, "Email campaign list lookup failed");
    res.status(503).json({ error: "L’historique des campagnes est indisponible." });
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
    const result = await db.transaction(async (transaction) => {
      const [campaign] = await transaction.select()
        .from(emailCampaignsTable)
        .where(eq(emailCampaignsTable.id, campaignId))
        .for("update")
        .limit(1);
      if (!campaign) return "missing" as const;
      if (campaign.status !== "draft" || campaign.recipientCount < 1) return "conflict" as const;
      await transaction.update(emailCampaignsTable).set({
        status: "queued",
        queuedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(emailCampaignsTable.id, campaignId));
      await transaction.update(emailCampaignRecipientsTable).set({
        status: "queued",
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(emailCampaignRecipientsTable.campaignId, campaignId),
        eq(emailCampaignRecipientsTable.status, "draft"),
      ));
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
    await recordAdminAudit({
      adminUserId,
      action: "queue_email_campaign",
      resourceType: "email_campaign",
      resourceId: campaignId,
    });
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
    await recordAdminAudit({
      adminUserId,
      action: "cancel_email_campaign",
      resourceType: "email_campaign",
      resourceId: campaignId,
    });
    const [campaign] = await getCampaignSummaries([campaignId]);
    res.json({ campaign });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign cancel request failed");
    res.status(503).json({ error: "La campagne n’a pas pu être annulée." });
  }
});

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
    await recordAdminAudit({
      adminUserId,
      action: "delete_email_campaign",
      resourceType: "email_campaign",
      resourceId: campaignId,
    });
    res.json({ deleted: true });
  } catch (error) {
    req.log.error({ err: error, campaignId }, "Email campaign draft deletion failed");
    res.status(503).json({ error: "Le brouillon de campagne n’a pas pu être supprimé." });
  }
});

export default adminRoutes;
