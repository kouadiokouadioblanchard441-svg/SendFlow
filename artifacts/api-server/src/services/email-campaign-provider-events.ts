import {
  and,
  db,
  emailCampaignAttemptsTable,
  emailCampaignProviderEventsTable,
  emailCampaignRecipientsTable,
  emailCampaignsTable,
  emailMarketingSuppressionsTable,
  eq,
  sql,
} from "@workspace/db";
import {
  campaignProviderStatusTransition,
  type CampaignProviderEventType,
} from "../lib/email-campaign-provider-policy";

export type StoredCampaignProviderEvent = {
  providerEventId: string;
  recipientId: string;
  attemptId: string;
  providerMessageId: string;
  eventType: CampaignProviderEventType;
  occurredAt: Date;
};

export type CampaignProviderEventResult = "processed" | "pending" | "duplicate" | "ignored";

type CampaignEmailTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyStoredEvent(
  transaction: CampaignEmailTransaction,
  event: StoredCampaignProviderEvent,
  receivedAt: Date,
) {
  const [attempt] = await transaction.select({
    id: emailCampaignAttemptsTable.id,
    recipientId: emailCampaignAttemptsTable.recipientId,
    status: emailCampaignAttemptsTable.status,
    providerMessageId: emailCampaignAttemptsTable.providerMessageId,
    providerUpdatedAt: emailCampaignAttemptsTable.providerUpdatedAt,
    emailSnapshotLookupHash: emailCampaignAttemptsTable.emailSnapshotLookupHash,
  }).from(emailCampaignAttemptsTable)
    .where(eq(emailCampaignAttemptsTable.id, event.attemptId))
    .limit(1);
  if (!attempt || attempt.recipientId !== event.recipientId) return "ignored" as const;

  if (!attempt.providerMessageId) return "pending" as const;
  if (attempt.providerMessageId !== event.providerMessageId) {
    await transaction.update(emailCampaignProviderEventsTable).set({
      processedAt: receivedAt,
    }).where(eq(emailCampaignProviderEventsTable.providerEventId, event.providerEventId));
    return "ignored" as const;
  }

  const [recipient] = await transaction.select({
    id: emailCampaignRecipientsTable.id,
    status: emailCampaignRecipientsTable.status,
    providerUpdatedAt: emailCampaignRecipientsTable.providerUpdatedAt,
  }).from(emailCampaignRecipientsTable)
    .where(eq(emailCampaignRecipientsTable.id, event.recipientId))
    .limit(1);
  if (!recipient || recipient.status === "cancelled") {
    await transaction.update(emailCampaignProviderEventsTable).set({
      processedAt: receivedAt,
    }).where(eq(emailCampaignProviderEventsTable.providerEventId, event.providerEventId));
    return "ignored" as const;
  }

  const attemptTransition = campaignProviderStatusTransition(
    attempt.status as Parameters<typeof campaignProviderStatusTransition>[0],
    attempt.providerUpdatedAt,
    event.eventType,
    event.occurredAt,
  );
  const recipientTransition = campaignProviderStatusTransition(
    recipient.status as Parameters<typeof campaignProviderStatusTransition>[0],
    recipient.providerUpdatedAt,
    event.eventType,
    event.occurredAt,
  );

  await transaction.update(emailCampaignAttemptsTable).set({
    status: attemptTransition.status,
    providerUpdatedAt: attemptTransition.providerUpdatedAt,
    errorClass: null,
    httpStatus: null,
    finishedAt: receivedAt,
    updatedAt: receivedAt,
  }).where(eq(emailCampaignAttemptsTable.id, event.attemptId));

  await transaction.update(emailCampaignRecipientsTable).set({
    status: recipientTransition.status,
    providerUpdatedAt: recipientTransition.providerUpdatedAt,
    lastErrorClass: null,
    lastErrorStatus: null,
    updatedAt: receivedAt,
  }).where(eq(emailCampaignRecipientsTable.id, event.recipientId));

  if (event.eventType === "email.bounced" || event.eventType === "email.complained") {
    const suppressionHash = attempt.emailSnapshotLookupHash;
    if (suppressionHash) {
      const reason = event.eventType === "email.complained" ? "complained" : "bounced";
      await transaction.insert(emailMarketingSuppressionsTable).values({
        emailLookupHash: suppressionHash,
        reason,
        providerEventId: event.providerEventId,
        createdAt: receivedAt,
        updatedAt: receivedAt,
      }).onConflictDoUpdate({
        target: emailMarketingSuppressionsTable.emailLookupHash,
        set: {
          reason: sql`CASE WHEN ${emailMarketingSuppressionsTable.reason} = 'complained' THEN 'complained' ELSE EXCLUDED.reason END`,
          providerEventId: event.providerEventId,
          updatedAt: receivedAt,
        },
      });
    }
  }

  await transaction.update(emailCampaignProviderEventsTable).set({
    processedAt: receivedAt,
  }).where(eq(emailCampaignProviderEventsTable.providerEventId, event.providerEventId));
  return "processed" as const;
}

export async function receiveCampaignProviderEvent(event: StoredCampaignProviderEvent): Promise<CampaignProviderEventResult> {
  return db.transaction(async (transaction) => {
    const [identity] = await transaction.select({
      campaignId: emailCampaignRecipientsTable.campaignId,
    }).from(emailCampaignAttemptsTable)
      .innerJoin(emailCampaignRecipientsTable, eq(emailCampaignRecipientsTable.id, emailCampaignAttemptsTable.recipientId))
      .where(and(
        eq(emailCampaignAttemptsTable.id, event.attemptId),
        eq(emailCampaignAttemptsTable.recipientId, event.recipientId),
      ))
      .limit(1);
    if (!identity) return "ignored";

    // This is the shared lock order used by admin mutations and the worker.
    const [campaign] = await transaction.select({ id: emailCampaignsTable.id })
      .from(emailCampaignsTable)
      .where(eq(emailCampaignsTable.id, identity.campaignId))
      .for("update")
      .limit(1);
    if (!campaign) return "ignored";
    const [recipient] = await transaction.select({ id: emailCampaignRecipientsTable.id })
      .from(emailCampaignRecipientsTable)
      .where(and(
        eq(emailCampaignRecipientsTable.id, event.recipientId),
        eq(emailCampaignRecipientsTable.campaignId, identity.campaignId),
      ))
      .for("update")
      .limit(1);
    if (!recipient) return "ignored";
    const [attempt] = await transaction.select({ id: emailCampaignAttemptsTable.id })
      .from(emailCampaignAttemptsTable)
      .where(and(
        eq(emailCampaignAttemptsTable.id, event.attemptId),
        eq(emailCampaignAttemptsTable.recipientId, event.recipientId),
      ))
      .for("update")
      .limit(1);
    if (!attempt) return "ignored";

    const [inserted] = await transaction.insert(emailCampaignProviderEventsTable).values({
      ...event,
      receivedAt: new Date(),
    }).onConflictDoNothing()
      .returning({ providerEventId: emailCampaignProviderEventsTable.providerEventId });
    const [stored] = inserted
      ? [event]
      : await transaction.select({
          providerEventId: emailCampaignProviderEventsTable.providerEventId,
          recipientId: emailCampaignProviderEventsTable.recipientId,
          attemptId: emailCampaignProviderEventsTable.attemptId,
          providerMessageId: emailCampaignProviderEventsTable.providerMessageId,
          eventType: emailCampaignProviderEventsTable.eventType,
          occurredAt: emailCampaignProviderEventsTable.occurredAt,
          processedAt: emailCampaignProviderEventsTable.processedAt,
        }).from(emailCampaignProviderEventsTable)
          .where(eq(emailCampaignProviderEventsTable.providerEventId, event.providerEventId))
          .limit(1);
    if (
      !stored
      || stored.recipientId !== event.recipientId
      || stored.attemptId !== event.attemptId
      || stored.providerMessageId !== event.providerMessageId
      || stored.eventType !== event.eventType
    ) return "ignored";
    if ("processedAt" in stored && stored.processedAt) return "duplicate";

    const result = await applyStoredEvent(transaction, event, new Date());
    return inserted ? result : result === "processed" ? "duplicate" : result;
  });
}

export async function applyPendingCampaignProviderEvents(
  transaction: CampaignEmailTransaction,
  attemptId: string,
  providerMessageId: string,
  receivedAt = new Date(),
) {
  const pending = await transaction.select({
    providerEventId: emailCampaignProviderEventsTable.providerEventId,
    recipientId: emailCampaignProviderEventsTable.recipientId,
    attemptId: emailCampaignProviderEventsTable.attemptId,
    providerMessageId: emailCampaignProviderEventsTable.providerMessageId,
    eventType: emailCampaignProviderEventsTable.eventType,
    occurredAt: emailCampaignProviderEventsTable.occurredAt,
  }).from(emailCampaignProviderEventsTable)
    .where(and(
      eq(emailCampaignProviderEventsTable.attemptId, attemptId),
      eq(emailCampaignProviderEventsTable.providerMessageId, providerMessageId),
      sql`${emailCampaignProviderEventsTable.processedAt} IS NULL`,
    ));
  for (const event of pending) {
    await applyStoredEvent(transaction, event as StoredCampaignProviderEvent, receivedAt);
  }
}
