import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  db,
  desc,
  eq,
  lt,
  or,
  payoutAttemptsTable,
  payoutRequestsTable,
  payoutStateEventsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import {
  CancelDeveloperPayoutParams,
  CancelDeveloperPayoutResponse,
  CreateDeveloperPayoutBody,
  CreateDeveloperPayoutHeader,
  CreateDeveloperPayoutQuoteBody,
  CreateDeveloperPayoutQuoteResponse,
  GetDeveloperPayoutParams,
  GetDeveloperPayoutResponse,
  ListDeveloperPayoutsQueryParams,
  ListDeveloperPayoutsResponse,
} from "@workspace/api-zod";
import { requireSecretApiKey } from "./developer";
import { loadPayoutQuoteConfiguration } from "../data/payout-configuration";
import { loadMerchantPayoutWallet } from "../data/payout-wallet-balance";
import {
  assertPayoutWalletCanCover,
  calculatePayoutQuote,
  PAYOUT_EXECUTION_ENABLED,
  PayoutPolicyError,
} from "../services/payout-policy";
import { decryptSensitiveData } from "../lib/sensitive-data-crypto";
import { enqueuePayoutWebhookEvent } from "../services/payout-webhook-outbox";

const router: IRouter = Router();

function presentPayout(row: typeof payoutRequestsTable.$inferSelect) {
  const phone = decryptSensitiveData(row.beneficiaryPhoneEncrypted, "payout-beneficiary-phone", {
    authenticatedContext: row.id,
  });
  const name = row.beneficiaryNameEncrypted
    ? decryptSensitiveData(row.beneficiaryNameEncrypted, "payout-beneficiary-name", {
      authenticatedContext: row.id,
    })
    : null;
  return {
    id: row.id,
    reference: row.reference,
    merchantReference: row.merchantReference,
    countryCode: row.countryCode,
    operatorId: row.operatorId,
    beneficiary: { phoneLast4: phone.slice(-4), name },
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
  };
}

function sendPayoutError(req: Request, res: Response, error: unknown) {
  if (error instanceof PayoutPolicyError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  req.log.error({ err: error }, "Payout API request failed");
  res.status(503).json({ error: "Le service payout est momentanément indisponible." });
}

router.post("/v1/payout-quote", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res, "payout_read");
  if (!key) return;
  const parsed = CreateDeveloperPayoutQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "La demande de devis payout est invalide." });
    return;
  }
  try {
    const wallet = await loadMerchantPayoutWallet(key.userId);
    if (wallet.availableMinor <= 0) {
      throw new PayoutPolicyError(422, "Le solde disponible SendFlow est insuffisant.");
    }
    const configuration = await loadPayoutQuoteConfiguration(
      parsed.data.countryCode,
      parsed.data.operatorId,
    );
    const quote = calculatePayoutQuote(parsed.data, configuration);
    assertPayoutWalletCanCover(wallet.availableMinor, quote.totalDebitMinor);
    res.setHeader("Cache-Control", "no-store");
    res.json(CreateDeveloperPayoutQuoteResponse.parse(
      { ...quote, availableBalanceMinor: wallet.availableMinor },
    ));
  } catch (error) {
    sendPayoutError(req, res, error);
  }
});

router.post("/v1/payouts", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res, "payout_create");
  if (!key) return;
  const validHeader = CreateDeveloperPayoutHeader.safeParse({
    "Idempotency-Key": req.get("Idempotency-Key"),
  });
  const parsedBody = CreateDeveloperPayoutBody.safeParse(req.body);
  if (!validHeader.success || !parsedBody.success) {
    res.status(400).json({ error: "La demande de payout ou sa clé d’idempotence est invalide." });
    return;
  }
  try {
    const wallet = await loadMerchantPayoutWallet(key.userId);
    if (wallet.availableMinor <= 0) {
      throw new PayoutPolicyError(422, "Le solde disponible SendFlow est insuffisant.");
    }
    const configuration = await loadPayoutQuoteConfiguration(
      parsedBody.data.countryCode,
      parsedBody.data.operatorId,
    );
    const quote = calculatePayoutQuote(parsedBody.data, configuration);
    assertPayoutWalletCanCover(wallet.availableMinor, quote.totalDebitMinor);
    if (!PAYOUT_EXECUTION_ENABLED) {
      res.status(503).json({
        error: "Le service de versement SendFlow est momentanément indisponible.",
        code: "payout_unavailable",
      });
      return;
    }
    // Execution remains fail-closed until a SendFlow-owned channel can prove
    // the final result for the exact merchant request.
    res.status(503).json({ error: "Le service de versement SendFlow est momentanément indisponible." });
  } catch (error) {
    sendPayoutError(req, res, error);
  }
});

router.get("/v1/payouts", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res, "payout_read");
  if (!key) return;
  const parsed = ListDeveloperPayoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Les filtres de consultation payout sont invalides." });
    return;
  }
  try {
    const limit = parsed.data.limit;
    const conditions = [eq(payoutRequestsTable.merchantUserId, key.userId)];
    if (parsed.data.status) conditions.push(eq(payoutRequestsTable.status, parsed.data.status));
    if (parsed.data.cursor) {
      const [cursorRow] = await db.select({
        id: payoutRequestsTable.id,
        createdAt: payoutRequestsTable.createdAt,
      }).from(payoutRequestsTable).where(and(
        eq(payoutRequestsTable.id, parsed.data.cursor),
        eq(payoutRequestsTable.merchantUserId, key.userId),
      )).limit(1);
      if (!cursorRow) {
        res.status(400).json({ error: "Le curseur payout est invalide." });
        return;
      }
      conditions.push(or(
        lt(payoutRequestsTable.createdAt, cursorRow.createdAt),
        and(
          eq(payoutRequestsTable.createdAt, cursorRow.createdAt),
          lt(payoutRequestsTable.id, cursorRow.id),
        ),
      )!);
    }
    const rows = await db.select().from(payoutRequestsTable).where(and(...conditions))
      .orderBy(desc(payoutRequestsTable.createdAt), desc(payoutRequestsTable.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    res.setHeader("Cache-Control", "no-store");
    res.json(ListDeveloperPayoutsResponse.parse({
      items: items.map(presentPayout),
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    }));
  } catch (error) {
    sendPayoutError(req, res, error);
  }
});

router.get("/v1/payouts/:payoutId", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res, "payout_read");
  if (!key) return;
  const params = GetDeveloperPayoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Payout introuvable." });
    return;
  }
  try {
    const [row] = await db.select().from(payoutRequestsTable).where(and(
      eq(payoutRequestsTable.id, params.data.payoutId),
      eq(payoutRequestsTable.merchantUserId, key.userId),
    )).limit(1);
    if (!row) {
      res.status(404).json({ error: "Payout introuvable." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(GetDeveloperPayoutResponse.parse(presentPayout(row)));
  } catch (error) {
    sendPayoutError(req, res, error);
  }
});

router.post("/v1/payouts/:payoutId/cancel", async (req, res): Promise<void> => {
  const key = await requireSecretApiKey(req, res, "payout_create");
  if (!key) return;
  const params = CancelDeveloperPayoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Payout introuvable." });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [snapshot] = await tx.select().from(payoutRequestsTable).where(and(
        eq(payoutRequestsTable.id, params.data.payoutId),
        eq(payoutRequestsTable.merchantUserId, key.userId),
      )).limit(1);
      if (!snapshot) return { kind: "missing" as const };
      await tx.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.id, key.userId)).for("update");
      await tx.select({ id: walletsTable.id }).from(walletsTable)
        .where(eq(walletsTable.id, snapshot.walletId)).for("update");
      const [row] = await tx.select().from(payoutRequestsTable)
        .where(eq(payoutRequestsTable.id, snapshot.id)).for("update");
      const [attempt] = await tx.select().from(payoutAttemptsTable)
        .where(eq(payoutAttemptsTable.payoutRequestId, snapshot.id)).for("update");
      if (!row || row.reservationState !== "active" || row.status !== "funds_reserved"
        || !attempt || attempt.dispatchedAt !== null || attempt.status !== "prepared") {
        return { kind: "conflict" as const };
      }
      const now = new Date();
      const [updated] = await tx.update(payoutRequestsTable).set({
        status: "cancelled",
        reservationState: "released",
        failureCode: "merchant_rejected",
        completedAt: now,
        updatedAt: now,
      }).where(and(
        eq(payoutRequestsTable.id, row.id),
        eq(payoutRequestsTable.status, "funds_reserved"),
        eq(payoutRequestsTable.reservationState, "active"),
      )).returning();
      if (!updated) return { kind: "conflict" as const };
      const [stateEvent] = await tx.insert(payoutStateEventsTable).values({
        payoutRequestId: row.id,
        fromStatus: row.status,
        toStatus: "cancelled",
        actorType: "merchant",
        actorId: key.userId,
        reasonCode: "merchant_cancelled",
      }).returning({ id: payoutStateEventsTable.id });
      if (!stateEvent) throw new Error("Payout cancellation event was not recorded");
      await enqueuePayoutWebhookEvent(tx, {
        payout: updated,
        stateEventId: stateEvent.id,
        occurredAt: now,
      });
      return { kind: "updated" as const, row: updated };
    });
    if (result.kind === "missing") {
      res.status(404).json({ error: "Payout introuvable." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "Ce payout a déjà été envoyé ou ne peut plus être annulé." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(CancelDeveloperPayoutResponse.parse(presentPayout(result.row)));
  } catch (error) {
    sendPayoutError(req, res, error);
  }
});

export default router;
