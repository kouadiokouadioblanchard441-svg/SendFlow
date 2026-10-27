import { randomUUID } from "node:crypto";
import {
  and,
  developerPaymentSessionsTable,
  developerWebhookDeliveriesTable,
  developerWebhookEndpointsTable,
  eq,
} from "@workspace/db";
import { db } from "@workspace/db";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function enqueueDeveloperPaymentEvent(
  tx: DbTransaction,
  input: {
    paymentLinkId: string;
    eventType: "payment.succeeded" | "payment.failed";
    attemptId: string;
    transactionId: string;
    amountMinor: number;
    currency: string;
    occurredAt: Date;
  },
) {
  const [session] = await tx.select({
    id: developerPaymentSessionsTable.id,
    userId: developerPaymentSessionsTable.userId,
    merchantReference: developerPaymentSessionsTable.merchantReference,
  }).from(developerPaymentSessionsTable)
    .where(eq(developerPaymentSessionsTable.paymentLinkId, input.paymentLinkId))
    .limit(1);
  if (!session) return;

  const endpoints = await tx.select({
    id: developerWebhookEndpointsTable.id,
    events: developerWebhookEndpointsTable.events,
  }).from(developerWebhookEndpointsTable)
    .where(and(
      eq(developerWebhookEndpointsTable.userId, session.userId),
      eq(developerWebhookEndpointsTable.status, "active"),
    ));
  if (!endpoints.length) return;

  for (const endpoint of endpoints) {
    if (!endpoint.events.includes(input.eventType)) continue;
    const eventId = randomUUID();
    const payload = {
      id: eventId,
      type: input.eventType,
      createdAt: input.occurredAt.toISOString(),
      data: {
        sessionId: session.id,
        merchantReference: session.merchantReference,
        attemptId: input.attemptId,
        transactionId: input.transactionId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        status: input.eventType === "payment.succeeded" ? "succeeded" : "failed",
      },
    };
    await tx.insert(developerWebhookDeliveriesTable).values({
      id: eventId,
      endpointId: endpoint.id,
      paymentSessionId: session.id,
      eventType: input.eventType,
      payload,
      status: "pending",
    }).onConflictDoNothing();
  }
}
