import { Router, type IRouter } from "express";
import {
  and,
  db,
  desc,
  eq,
  inArray,
  lt,
  or,
  payoutAttemptsTable,
  payoutRequestsTable,
  payoutStateEventsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import {
  AdminPayoutListResponse,
  GetAdminPayoutParams,
  GetAdminPayoutResponse,
  ListAdminPayoutsQueryParams,
  ListAdminPayoutsResponse,
  RejectAdminPayoutBody,
  RejectAdminPayoutParams,
  RejectAdminPayoutResponse,
} from "@workspace/api-zod";
import { isTrustedOrigin } from "../lib/request-security";
import { decryptSensitiveData } from "../lib/sensitive-data-crypto";
import { recordAdminAudit } from "../lib/admin-audit";
import { enqueuePayoutWebhookEvent } from "../services/payout-webhook-outbox";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

function presentAdminPayout(row: typeof payoutRequestsTable.$inferSelect, timeline: Array<{
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  reasonCode: string;
  createdAt: Date;
}>) {
  const phone = decryptSensitiveData(row.beneficiaryPhoneEncrypted, "payout-beneficiary-phone", {
    authenticatedContext: row.id,
  });
  return {
    id: row.id,
    reference: row.reference,
    merchantReference: row.merchantReference,
    countryCode: row.countryCode,
    operatorId: row.operatorId,
    beneficiary: { phoneLast4: phone.slice(-4), name: null },
    amountMinor: row.amountMinor,
    currency: row.currency,
    feeMinor: row.feeMinor,
    totalDebitMinor: row.totalDebitMinor,
    beneficiaryAmountMinor: row.beneficiaryAmountMinor,
    feePayer: row.feePayer,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    failureCode: row.failureCode,
    merchantUserId: row.merchantUserId,
    reservationState: row.reservationState,
    timeline: timeline.map((event) => ({
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      reasonCode: event.reasonCode,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function readTimeline(ids: string[]) {
  if (ids.length === 0) return new Map<string, Array<typeof payoutStateEventsTable.$inferSelect>>();
  const rows = await db.select().from(payoutStateEventsTable)
    .where(inArray(payoutStateEventsTable.payoutRequestId, ids))
    .orderBy(payoutStateEventsTable.createdAt, payoutStateEventsTable.id);
  const grouped = new Map<string, Array<typeof payoutStateEventsTable.$inferSelect>>();
  for (const row of rows) {
    const events = grouped.get(row.payoutRequestId) ?? [];
    events.push(row);
    grouped.set(row.payoutRequestId, events);
  }
  return grouped;
}

router.get("/payouts", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  const parsed = ListAdminPayoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtres payout invalides." });
    return;
  }
  try {
    const conditions = [];
    if (parsed.data.status) conditions.push(eq(payoutRequestsTable.status, parsed.data.status));
    if (parsed.data.cursor) {
      const [cursor] = await db.select({
        id: payoutRequestsTable.id,
        createdAt: payoutRequestsTable.createdAt,
      }).from(payoutRequestsTable).where(eq(payoutRequestsTable.id, parsed.data.cursor)).limit(1);
      if (!cursor) {
        res.status(400).json({ error: "Curseur payout invalide." });
        return;
      }
      conditions.push(or(
        lt(payoutRequestsTable.createdAt, cursor.createdAt),
        and(
          eq(payoutRequestsTable.createdAt, cursor.createdAt),
          lt(payoutRequestsTable.id, cursor.id),
        ),
      )!);
    }
    const rows = await db.select().from(payoutRequestsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(payoutRequestsTable.createdAt), desc(payoutRequestsTable.id))
      .limit(parsed.data.limit + 1);
    const hasMore = rows.length > parsed.data.limit;
    const items = rows.slice(0, parsed.data.limit);
    const timeline = await readTimeline(items.map((row) => row.id));
    await recordAdminAudit({
      adminUserId,
      action: "view_payout_queue",
      resourceType: "payout",
      resourceId: "queue",
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(ListAdminPayoutsResponse.parse({
      items: items.map((row) => presentAdminPayout(row, timeline.get(row.id) ?? [])),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Admin payout queue lookup failed");
    res.status(503).json({ error: "La file payout est momentanément indisponible." });
  }
});

router.get("/payouts/:payoutId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  const params = GetAdminPayoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Payout introuvable." });
    return;
  }
  try {
    const [row] = await db.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, params.data.payoutId)).limit(1);
    if (!row) {
      res.status(404).json({ error: "Payout introuvable." });
      return;
    }
    const timeline = await readTimeline([row.id]);
    await recordAdminAudit({
      adminUserId,
      action: "view_payout",
      resourceType: "payout",
      resourceId: row.id,
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminPayoutResponse.parse(presentAdminPayout(row, timeline.get(row.id) ?? [])));
  } catch (error) {
    req.log.error({ err: error }, "Admin payout lookup failed");
    res.status(503).json({ error: "Le payout est momentanément indisponible." });
  }
});

router.post("/payouts/:payoutId/reject", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de la requête non autorisée." });
    return;
  }
  const params = RejectAdminPayoutParams.safeParse(req.params);
  const body = RejectAdminPayoutBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Motif de rejet invalide." });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [snapshot] = await tx.select().from(payoutRequestsTable)
        .where(eq(payoutRequestsTable.id, params.data.payoutId)).limit(1);
      if (!snapshot) return { kind: "missing" as const };
      await tx.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.id, snapshot.merchantUserId)).for("update");
      await tx.select({ id: walletsTable.id }).from(walletsTable)
        .where(eq(walletsTable.id, snapshot.walletId)).for("update");
      const [row] = await tx.select().from(payoutRequestsTable)
        .where(eq(payoutRequestsTable.id, snapshot.id)).for("update");
      const [attempt] = await tx.select().from(payoutAttemptsTable)
        .where(eq(payoutAttemptsTable.payoutRequestId, snapshot.id)).for("update");
      if (!row || row.status !== "funds_reserved" || row.reservationState !== "active"
        || !attempt || attempt.status !== "prepared" || attempt.dispatchedAt !== null) {
        return { kind: "conflict" as const };
      }
      const now = new Date();
      const [updated] = await tx.update(payoutRequestsTable).set({
        status: "rejected",
        reservationState: "released",
        failureCode: "admin_rejected",
        completedAt: now,
        updatedAt: now,
      }).where(and(
        eq(payoutRequestsTable.id, row.id),
        eq(payoutRequestsTable.status, "funds_reserved"),
        eq(payoutRequestsTable.reservationState, "active"),
      )).returning();
      if (!updated) return { kind: "conflict" as const };
      const [event] = await tx.insert(payoutStateEventsTable).values({
        payoutRequestId: row.id,
        fromStatus: row.status,
        toStatus: "rejected",
        actorType: "admin",
        actorId: adminUserId,
        reasonCode: "admin_rejected",
      }).returning({ id: payoutStateEventsTable.id });
      if (!event) throw new Error("Payout rejection event was not recorded");
      await enqueuePayoutWebhookEvent(tx, {
        payout: updated,
        stateEventId: event.id,
        occurredAt: now,
      });
      await recordAdminAudit({
        adminUserId,
        action: "reject_undispatched_payout",
        resourceType: "payout",
        resourceId: row.id,
        reason: body.data.reason.trim(),
      }, tx);
      return { kind: "updated" as const, row: updated, event };
    });
    if (result.kind === "missing") {
      res.status(404).json({ error: "Payout introuvable." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "Un payout déjà envoyé ne peut pas être rejeté ni libéré manuellement." });
      return;
    }
    const timeline = await readTimeline([result.row.id]);
    res.setHeader("Cache-Control", "no-store");
    res.json(RejectAdminPayoutResponse.parse(
      presentAdminPayout(result.row, timeline.get(result.row.id) ?? []),
    ));
  } catch (error) {
    req.log.error({ err: error }, "Admin payout rejection failed");
    res.status(503).json({ error: "Le payout n’a pas pu être mis à jour." });
  }
});

export default router;
