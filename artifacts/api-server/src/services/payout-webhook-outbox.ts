import { randomUUID } from "node:crypto";
import {
  and,
  db,
  developerWebhookDeliveriesTable,
  developerWebhookEndpointsTable,
  eq,
  type payoutRequestsTable,
} from "@workspace/db";
import {
  encryptPayoutWebhookPayload,
  type PayoutWebhookEventType,
  type PayoutWebhookPayload,
} from "../lib/payout-webhook-payload";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PayoutRequest = typeof payoutRequestsTable.$inferSelect;

const EVENT_FOR_STATUS: Partial<Record<PayoutRequest["status"], PayoutWebhookEventType>> = {
  funds_reserved: "payout.created",
  submitted: "payout.processing",
  processing: "payout.processing",
  succeeded: "payout.succeeded",
  failed: "payout.failed",
  rejected: "payout.failed",
  cancelled: "payout.failed",
  uncertain: "payout.uncertain",
};

export async function enqueuePayoutWebhookEvent(
  tx: DbTransaction,
  input: { payout: PayoutRequest; stateEventId: string; occurredAt: Date },
) {
  const eventType = EVENT_FOR_STATUS[input.payout.status];
  if (!eventType) return;
  const feePayer = input.payout.feePayer === "merchant" || input.payout.feePayer === "beneficiary"
    ? input.payout.feePayer
    : null;
  const status = input.payout.status;
  if (!feePayer || ![
    "funds_reserved", "submitted", "processing", "succeeded",
    "failed", "rejected", "cancelled", "uncertain",
  ].includes(status)) {
    throw new Error("Payout webhook state is outside the supported event contract");
  }
  const endpoints = await tx.select({
    id: developerWebhookEndpointsTable.id,
    events: developerWebhookEndpointsTable.events,
  }).from(developerWebhookEndpointsTable)
    .where(and(
      eq(developerWebhookEndpointsTable.userId, input.payout.merchantUserId),
      eq(developerWebhookEndpointsTable.status, "active"),
    ));
  for (const endpoint of endpoints) {
    if (!endpoint.events.includes(eventType)) continue;
    const deliveryId = randomUUID();
    const payload: PayoutWebhookPayload = {
      id: deliveryId,
      type: eventType,
      createdAt: input.occurredAt.toISOString(),
      data: {
        amountMinor: input.payout.amountMinor,
        beneficiaryAmountMinor: input.payout.beneficiaryAmountMinor,
        countryCode: input.payout.countryCode,
        currency: "XOF" as const,
        feeMinor: input.payout.feeMinor,
        feePayer,
        merchantReference: input.payout.merchantReference,
        operatorId: input.payout.operatorId,
        payoutId: input.payout.id,
        reference: input.payout.reference,
        status: status as PayoutWebhookPayload["data"]["status"],
        totalDebitMinor: input.payout.totalDebitMinor,
      },
    };
    await tx.insert(developerWebhookDeliveriesTable).values({
      id: deliveryId,
      endpointId: endpoint.id,
      payoutRequestId: input.payout.id,
      payoutStateEventId: input.stateEventId,
      eventType,
      payload: encryptPayoutWebhookPayload(payload, deliveryId),
      status: "pending",
    }).onConflictDoNothing();
  }
}
