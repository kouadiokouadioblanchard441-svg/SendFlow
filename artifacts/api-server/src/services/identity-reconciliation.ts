import { db, eq, sql, identityVerificationsTable as verifications, identityWebhookEventsTable } from "@workspace/db";
import { retrieveDiditDecision, isDiditStatus } from "../lib/didit";
import { encryptSensitiveData } from "../lib/sensitive-data-crypto";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Caller holds the verification row lock. Every new event invalidates in-flight reads. */
export async function requireIdentityReconciliation(tx: Transaction, id: string) {
  await tx.update(verifications).set({
    reconciliationRequired: true,
    reconciliationVersion: sql`${verifications.reconciliationVersion} + 1`,
    reconciliationRequestedAt: sql`coalesce(${verifications.reconciliationRequestedAt}, now())`,
    status: sql`case when ${verifications.status} = 'Approved' then 'In Review' else ${verifications.status} end`,
    updatedAt: new Date(),
  }).where(eq(verifications.id, id));
}

// Dependency injection is internal only: no HTTP route accepts a decision or
// resolver. The operational entry point always uses retrieveDiditDecision.
export async function reconcileIdentityVerification(
  id: string,
  readDecision: (sessionId: string) => Promise<unknown> = retrieveDiditDecision,
) {
  const [before] = await db.select().from(verifications).where(eq(verifications.id, id));
  if (!before?.reconciliationRequired) return "not_pending" as const;
  const startedAt = new Date();
  const raw = await readDecision(before.providerSessionId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid Didit decision");
  const decision = raw as Record<string, unknown>;
  // Decision created_at is session creation, NOT the webhook record-update time.
  // Never compare it with lastProviderEventAt or use it to order future events.
  if (decision.session_id !== before.providerSessionId
    || decision.vendor_data !== before.vendorData
    || decision.environment !== process.env.DIDIT_ENVIRONMENT
    || decision.workflow_id !== process.env.DIDIT_WORKFLOW_ID
    || !process.env.DIDIT_WORKFLOW_ID
    || typeof decision.status !== "string" || !isDiditStatus(decision.status)
    || (decision.session_kind !== undefined && decision.session_kind !== "user")) {
    throw new Error("Didit decision binding failed");
  }
  if (decision.status === "Approved" && decision.expires_at != null
    && (typeof decision.expires_at !== "string"
      || !Number.isFinite(Date.parse(decision.expires_at))
      || Date.parse(decision.expires_at) <= Date.now())) {
    throw new Error("Didit approval is expired or invalid");
  }
  const status = decision.status;
  const evidence = encryptSensitiveData(JSON.stringify({ fetchedAt: startedAt.toISOString(), decision }),
    "identity-webhook-payload");
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(verifications).where(eq(verifications.id, id)).for("update");
    if (!current?.reconciliationRequired) return "not_pending" as const;
    if (current.reconciliationVersion !== before.reconciliationVersion) return "superseded" as const;
    await tx.insert(identityWebhookEventsTable).values({
      eventId: `reconciliation:${id}:${current.reconciliationVersion}`,
      providerSessionId: current.providerSessionId, eventType: "reconciliation.resolved",
      status, matchedVerification: true, statusApplied: true, encryptedPayload: evidence,
    });
    await tx.update(verifications).set({
      status, reconciliationRequired: false, reconciledAt: new Date(),
      reconciliationRequestedAt: null,
      // Conservative freshness fence: events older than this server read must
      // trigger another reconciliation, not undo the authoritative snapshot.
      lastProviderEventAt: new Date(Math.max(
        Math.ceil(startedAt.getTime() / 1000) * 1000,
        current.lastProviderEventAt?.getTime() ?? 0,
      )),
      updatedAt: new Date(),
    }).where(eq(verifications.id, id));
    return "resolved" as const;
  });
}
