import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  and,
  db,
  eq,
  payoutAttemptsTable,
  payoutConfirmationsTable,
  payoutRequestsTable,
  payoutStateEventsTable,
  sql,
  usersTable,
  walletLedgerTable,
  walletsTable,
} from "@workspace/db";
import { getAccountLimitSnapshot } from "../lib/account-limit";
import { isWithinMonthlyAccountLimit } from "../lib/account-limit-policy";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveData,
  encryptSensitiveData,
} from "../lib/sensitive-data-crypto";
import { FeexpayClient, FeexpayError, type FeexpayReceipt } from "../providers/feexpay/client";
import { feexpayChannelForOperator } from "../providers/feexpay/catalog";
import {
  isPayoutExecutionEnabled,
  type PayoutQuoteConfiguration,
} from "./payout-policy";
import { resolveVerifiedFinalStatus } from "./payout-settlement-verification";
import { enqueuePayoutWebhookEvent } from "./payout-webhook-outbox";

type PayoutTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PayoutRequest = typeof payoutRequestsTable.$inferSelect;

export type PayoutExecutionInput = {
  merchantUserId: string;
  apiKeyId: string;
  idempotencyKey: string;
  merchantReference: string | null;
  amountMinor: number;
  countryCode: string;
  operatorId: string;
  currency: "XOF";
  feePayer: "merchant" | "beneficiary";
  beneficiaryPhone: string;
  beneficiaryName: string | null;
  configuration: PayoutQuoteConfiguration;
  feePercent: number;
  pricingVersion: number;
  feeMinor: number;
  totalDebitMinor: number;
  beneficiaryAmountMinor: number;
};

function makeReference() {
  return `SFPO${randomBytes(8).toString("hex").toUpperCase()}`;
}

function makeRequestHash(input: PayoutExecutionInput, phoneHash: string) {
  return createHash("sha256").update(JSON.stringify({
    amountMinor: input.amountMinor,
    countryCode: input.countryCode,
    currency: input.currency,
    feePayer: input.feePayer,
    merchantReference: input.merchantReference,
    operatorId: input.operatorId,
    phoneHash,
    beneficiaryName: input.beneficiaryName?.trim().normalize("NFKC") ?? null,
  })).digest("hex");
}

async function insertStateEvent(
  tx: PayoutTransaction,
  payout: PayoutRequest,
  fromStatus: string | null,
  toStatus: PayoutRequest["status"],
  reasonCode: string,
) {
  const [event] = await tx.insert(payoutStateEventsTable).values({
    payoutRequestId: payout.id,
    fromStatus,
    toStatus,
    actorType: "system",
    actorId: "system:payout",
    reasonCode,
  }).returning({ id: payoutStateEventsTable.id });
  if (!event) throw new Error("Payout state event was not recorded");
  await enqueuePayoutWebhookEvent(tx, {
    payout: { ...payout, status: toStatus },
    stateEventId: event.id,
    occurredAt: new Date(),
  });
}

async function preparePayout(input: PayoutExecutionInput) {
  const phoneHash = createSensitiveDataLookupIndex(
    input.beneficiaryPhone,
    "payout-beneficiary-phone",
  );
  const requestHash = makeRequestHash(input, phoneHash);
  const reference = makeReference();
  const payoutId = randomUUID();
  const operationReference = reference;
  const shopId = process.env.FEEXPAY_SHOP_ID!;
  const accountHash = createSensitiveDataLookupIndex(shopId, "payout-execution-account");
  const channelId = feexpayChannelForOperator(input.countryCode, input.operatorId)?.id;
  if (!channelId) throw new Error("Payout provider channel is unavailable");

  return db.transaction(async (tx) => {
    await tx.select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, input.merchantUserId))
      .for("update");
    const monthlyLimit = await getAccountLimitSnapshot(input.merchantUserId);
    if (!isWithinMonthlyAccountLimit(input.amountMinor, monthlyLimit.remainingAmount)) {
      return { kind: "monthly_limit" as const };
    }
    const [wallet] = await tx.select().from(walletsTable)
      .where(eq(walletsTable.userId, input.merchantUserId)).for("update").limit(1);
    if (!wallet) throw new Error("Payout wallet is missing");

    const [existing] = await tx.select().from(payoutRequestsTable).where(and(
      eq(payoutRequestsTable.merchantUserId, input.merchantUserId),
      eq(payoutRequestsTable.idempotencyKey, input.idempotencyKey),
    )).for("update").limit(1);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return { kind: "idempotency_conflict" as const };
      }
      return { kind: "existing" as const, payout: existing };
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [daily] = await tx.select({
      amount: sql<string>`coalesce(sum(${payoutRequestsTable.totalDebitMinor}), 0)::text`,
    }).from(payoutRequestsTable).where(and(
      eq(payoutRequestsTable.merchantUserId, input.merchantUserId),
      eq(payoutRequestsTable.currency, "XOF"),
      sql`${payoutRequestsTable.createdAt} >= ${dayStart}`,
      sql`(${payoutRequestsTable.status} = 'succeeded' OR ${payoutRequestsTable.reservationState} = 'active')`,
    ));
    const usedToday = Number(daily?.amount ?? 0);
    const dailyMaximum = input.configuration.maximumPayoutDailyMinor;
    if (!Number.isSafeInteger(usedToday) || usedToday < 0 ||
      !Number.isSafeInteger(dailyMaximum) || dailyMaximum === null ||
      usedToday + input.totalDebitMinor < usedToday) {
      throw new Error("Payout daily limit could not be verified");
    }
    if (usedToday + input.totalDebitMinor > dailyMaximum) {
      return { kind: "daily_limit" as const };
    }

    const encryptedPhone = encryptSensitiveData(input.beneficiaryPhone, "payout-beneficiary-phone", {
      authenticatedContext: payoutId,
    });
    const encryptedName = input.beneficiaryName
      ? encryptSensitiveData(input.beneficiaryName.trim().normalize("NFKC"), "payout-beneficiary-name", {
        authenticatedContext: payoutId,
      })
      : null;
    const feeRateUnits = Math.round(input.feePercent * 10_000);
    const [created] = await tx.insert(payoutRequestsTable).values({
      id: payoutId,
      reference,
      merchantUserId: input.merchantUserId,
      apiKeyId: input.apiKeyId,
      walletId: wallet.id,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      merchantReference: input.merchantReference,
      countryCode: input.countryCode,
      operatorId: input.operatorId,
      beneficiaryPhoneEncrypted: encryptedPhone,
      beneficiaryPhoneHash: phoneHash,
      beneficiaryNameEncrypted: encryptedName,
      amountMinor: input.amountMinor,
      currency: input.currency,
      feeRateUnits,
      feePayer: input.feePayer,
      feeMinor: input.feeMinor,
      totalDebitMinor: input.totalDebitMinor,
      beneficiaryAmountMinor: input.beneficiaryAmountMinor,
      pricingVersion: input.pricingVersion,
      status: "created",
      reservationState: "none",
    }).returning();
    if (!created) throw new Error("Payout request was not created");

    const [validated] = await tx.update(payoutRequestsTable).set({
      status: "validated",
      updatedAt: new Date(),
    }).where(eq(payoutRequestsTable.id, created.id)).returning();
    if (!validated) throw new Error("Payout request was not validated");
    await insertStateEvent(tx, validated, "created", "validated", "request_validated");

    const [attempt] = await tx.insert(payoutAttemptsTable).values({
      payoutRequestId: payoutId,
      operationReference,
      status: "prepared",
      expectedExecutionAccountHash: accountHash,
      expectedExecutionChannelId: channelId,
    }).returning({ id: payoutAttemptsTable.id });
    if (!attempt) throw new Error("Payout attempt was not prepared");

    const [reserved] = await tx.update(payoutRequestsTable).set({
      status: "funds_reserved",
      reservationState: "active",
      reservedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(payoutRequestsTable.id, payoutId)).returning();
    if (!reserved) throw new Error("Payout funds could not be reserved");
    await insertStateEvent(tx, reserved, "validated", "funds_reserved", "funds_reserved");
    return { kind: "created" as const, payout: reserved };
  });
}

async function markUncertain(payoutId: string) {
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutId)).for("update").limit(1);
    const [attempt] = await tx.select().from(payoutAttemptsTable)
      .where(eq(payoutAttemptsTable.payoutRequestId, payoutId)).for("update").limit(1);
    if (!payout || !attempt || ["succeeded", "failed", "cancelled", "rejected"].includes(payout.status)) return;
    const now = new Date();
    if (attempt.status === "dispatching" || attempt.status === "pending") {
      await tx.update(payoutAttemptsTable).set({ status: "uncertain", updatedAt: now })
        .where(eq(payoutAttemptsTable.id, attempt.id));
    }
    if (payout.status !== "uncertain") {
      const [updated] = await tx.update(payoutRequestsTable).set({
        status: "uncertain",
        failureCode: "execution_unavailable",
        updatedAt: now,
      }).where(eq(payoutRequestsTable.id, payout.id)).returning();
      if (updated) await insertStateEvent(tx, updated, payout.status, "uncertain", "execution_uncertain");
    }
  });
}

async function claimPayoutDispatch(payoutId: string) {
  return db.transaction(async (tx) => {
    const [payout] = await tx.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutId)).for("update").limit(1);
    const [attempt] = await tx.select().from(payoutAttemptsTable)
      .where(eq(payoutAttemptsTable.payoutRequestId, payoutId)).for("update").limit(1);
    if (!payout || !attempt || payout.status !== "funds_reserved" ||
      payout.reservationState !== "active" || attempt.status !== "prepared" ||
      attempt.dispatchedAt !== null) return null;

    const now = new Date();
    const [claimedAttempt] = await tx.update(payoutAttemptsTable).set({
      status: "dispatching",
      dispatchedAt: now,
      updatedAt: now,
    }).where(eq(payoutAttemptsTable.id, attempt.id)).returning();
    if (!claimedAttempt) return null;
    const [submitted] = await tx.update(payoutRequestsTable).set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    }).where(eq(payoutRequestsTable.id, payout.id)).returning();
    if (!submitted) throw new Error("Payout dispatch state was not recorded");
    await insertStateEvent(tx, submitted, "funds_reserved", "submitted", "provider_dispatch_started");
    return { payout: submitted, attempt: claimedAttempt };
  });
}

async function persistProviderReference(
  payoutId: string,
  attemptId: string,
  receipt: FeexpayReceipt,
) {
  const providerReferenceHash = createSensitiveDataLookupIndex(receipt.reference, "provider-reference");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [payout] = await tx.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutId)).for("update").limit(1);
    const [attempt] = await tx.select().from(payoutAttemptsTable)
      .where(eq(payoutAttemptsTable.id, attemptId)).for("update").limit(1);
    if (!payout || !attempt || attempt.status !== "dispatching" ||
      payout.status !== "submitted" || attempt.executionReferenceHash) return false;
    const encryptedReference = encryptSensitiveData(receipt.reference, "provider-reference", {
      authenticatedContext: payout.id,
    });
    await tx.update(payoutAttemptsTable).set({
      status: "pending",
      executionReferenceEncrypted: encryptedReference,
      executionReferenceHash: providerReferenceHash,
      updatedAt: now,
    }).where(eq(payoutAttemptsTable.id, attempt.id));
    const [updated] = await tx.update(payoutRequestsTable).set({
      status: "processing",
      executionReferenceEncrypted: encryptedReference,
      executionReferenceHash: providerReferenceHash,
      failureCode: null,
      updatedAt: now,
    }).where(eq(payoutRequestsTable.id, payout.id)).returning();
    if (!updated) throw new Error("Payout provider reference was not recorded");
    await insertStateEvent(tx, updated, "submitted", "processing", "provider_reference_recorded");
    return true;
  });
}

async function settlePayout(
  payoutId: string,
  attemptId: string,
  receipt: FeexpayReceipt,
) {
  if (receipt.status === "PENDING") return;
  await db.transaction(async (tx) => {
    const [snapshot] = await tx.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutId)).limit(1);
    if (!snapshot) return;
    await tx.select({ id: walletsTable.id }).from(walletsTable)
      .where(eq(walletsTable.id, snapshot.walletId)).for("update");
    const [payout] = await tx.select().from(payoutRequestsTable)
      .where(eq(payoutRequestsTable.id, payoutId)).for("update").limit(1);
    const [attempt] = await tx.select().from(payoutAttemptsTable)
      .where(eq(payoutAttemptsTable.id, attemptId)).for("update").limit(1);
    if (!payout || !attempt || !["processing", "uncertain"].includes(payout.status) ||
      !["pending", "uncertain"].includes(attempt.status) ||
      !resolveVerifiedFinalStatus(payout, attempt, receipt)) return;

    const [wallet] = await tx.select().from(walletsTable)
      .where(eq(walletsTable.id, payout.walletId)).for("update").limit(1);
    if (!wallet || (receipt.status === "SUCCESSFUL" && wallet.balanceMinor < payout.totalDebitMinor)) return;
    const now = new Date();
    const finalStatus = receipt.status === "SUCCESSFUL" ? "succeeded" : "failed";
    const proofEvidence = JSON.stringify({
      source: "authenticated_provider_status",
      operation: "payout",
      reference: receipt.reference,
      status: receipt.status,
      amountMinor: receipt.amountMinor,
      currency: receipt.currency ?? payout.currency,
      phoneNumber: receipt.phoneNumber ?? null,
      payoutId: payout.id,
      providerChannelId: attempt.expectedExecutionChannelId,
      executionAccountHash: attempt.expectedExecutionAccountHash,
    });
    const [proof] = await tx.insert(payoutConfirmationsTable).values({
      payoutRequestId: payout.id,
      attemptId: attempt.id,
      verificationSource: "status_check",
      executionStatus: finalStatus === "succeeded" ? "SUCCEEDED" : "FAILED",
      executionReferenceHash: attempt.executionReferenceHash!,
      amountMinor: payout.beneficiaryAmountMinor,
      currency: payout.currency,
      executionAccountHash: attempt.expectedExecutionAccountHash,
      executionChannelId: attempt.expectedExecutionChannelId,
      operation: "payout",
      countryCode: payout.countryCode,
      operatorId: payout.operatorId,
      beneficiaryPhoneHash: payout.beneficiaryPhoneHash,
      verificationPassed: true,
      evidenceEncrypted: encryptSensitiveData(proofEvidence, "payout-confirmation-evidence", {
        authenticatedContext: payout.id,
      }),
      verifiedAt: now,
    }).returning({ id: payoutConfirmationsTable.id });
    if (!proof) throw new Error("Payout settlement evidence was not recorded");

    let ledgerEntryId: string | null = null;
    if (finalStatus === "succeeded") {
      const balanceAfterMinor = wallet.balanceMinor - payout.totalDebitMinor;
      const [entry] = await tx.insert(walletLedgerTable).values({
        walletId: wallet.id,
        userId: payout.merchantUserId,
        direction: "debit",
        amountMinor: payout.totalDebitMinor,
        balanceBeforeMinor: wallet.balanceMinor,
        balanceAfterMinor,
        currency: payout.currency,
        reason: `Versement marchand confirmé ${payout.reference}`,
        adminUserId: "system:payout",
        idempotencyKey: `payout:${payout.id}:debit`,
      }).returning({ id: walletLedgerTable.id });
      if (!entry) throw new Error("Payout debit was not recorded");
      ledgerEntryId = entry.id;
    }

    await tx.update(payoutAttemptsTable).set({
      status: finalStatus === "succeeded" ? "succeeded" : "failed",
      finalConfirmationId: proof.id,
      updatedAt: now,
    }).where(eq(payoutAttemptsTable.id, attempt.id));
    const [updated] = await tx.update(payoutRequestsTable).set({
      status: finalStatus,
      reservationState: finalStatus === "succeeded" ? "consumed" : "released",
      failureCode: finalStatus === "failed" ? "execution_failed" : null,
      finalConfirmationId: proof.id,
      ledgerEntryId,
      completedAt: now,
      updatedAt: now,
    }).where(eq(payoutRequestsTable.id, payout.id)).returning();
    if (!updated) throw new Error("Payout final state was not recorded");
    if (ledgerEntryId !== null) {
      await tx.update(walletsTable).set({
        balanceMinor: wallet.balanceMinor - payout.totalDebitMinor,
        updatedAt: now,
      }).where(eq(walletsTable.id, wallet.id));
    }
    await insertStateEvent(tx, updated, payout.status, finalStatus, `provider_${finalStatus}`);
  });
}

export async function dispatchPayout(payoutId: string) {
  const claimed = await claimPayoutDispatch(payoutId);
  if (!claimed) return;
  const { payout, attempt } = claimed;
  try {
    const phone = decryptSensitiveData(payout.beneficiaryPhoneEncrypted, "payout-beneficiary-phone", {
      authenticatedContext: payout.id,
    }).replace(/\D/g, "");
    const receipt = await new FeexpayClient().initiate("payout", {
      channelId: attempt.expectedExecutionChannelId,
      amountMinor: payout.beneficiaryAmountMinor,
      currency: "XOF",
      phoneNumber: phone,
      operationReference: attempt.operationReference,
    });
    if (!receipt.reference || !await persistProviderReference(payout.id, attempt.id, receipt)) {
      await markUncertain(payout.id);
      return;
    }
    await reconcilePayout(payout.id, true);
  } catch (error) {
    if (error instanceof FeexpayError &&
      ["CONFIGURATION_REQUIRED", "LIVE_DISABLED", "INVALID_INPUT", "CHANNEL_UNAVAILABLE", "CURRENCY_UNAVAILABLE"].includes(error.code)) {
      await markUncertain(payout.id);
      return;
    }
    await markUncertain(payout.id);
  }
}

export async function reconcilePayout(payoutId: string, force = false) {
  const [payout] = await db.select().from(payoutRequestsTable)
    .where(eq(payoutRequestsTable.id, payoutId)).limit(1);
  if (!payout || !["processing", "uncertain"].includes(payout.status) ||
    !payout.executionReferenceEncrypted || !payout.executionReferenceHash) return;
  if (!force && Date.now() - payout.updatedAt.getTime() < 5_000) return;
  const [attempt] = await db.select().from(payoutAttemptsTable)
    .where(eq(payoutAttemptsTable.payoutRequestId, payoutId)).limit(1);
  if (!attempt || !attempt.executionReferenceEncrypted || !attempt.executionReferenceHash) return;
  const shopId = process.env.FEEXPAY_SHOP_ID;
  if (!isPayoutExecutionEnabled() || !shopId ||
    createSensitiveDataLookupIndex(shopId, "payout-execution-account") !==
      attempt.expectedExecutionAccountHash) {
    await markUncertain(payout.id);
    return;
  }
  const providerReference = decryptSensitiveData(
    payout.executionReferenceEncrypted,
    "provider-reference",
    { authenticatedContext: payout.id },
  );
  try {
    const receipt = await new FeexpayClient().getStatus("payout", providerReference);
    if (receipt.status === "PENDING") {
      await db.transaction(async (tx) => {
        const [current] = await tx.select().from(payoutRequestsTable)
          .where(eq(payoutRequestsTable.id, payout.id)).for("update").limit(1);
        const [currentAttempt] = await tx.select().from(payoutAttemptsTable)
          .where(eq(payoutAttemptsTable.id, attempt.id)).for("update").limit(1);
        if (!current || !currentAttempt || ["succeeded", "failed"].includes(current.status)) return;
        const previousStatus = current.status;
        const now = new Date();
        const [updated] = await tx.update(payoutRequestsTable).set({
          status: "processing",
          failureCode: null,
          updatedAt: now,
        }).where(eq(payoutRequestsTable.id, current.id)).returning();
        await tx.update(payoutAttemptsTable).set({
          status: "pending",
          updatedAt: now,
        }).where(eq(payoutAttemptsTable.id, currentAttempt.id));
        if (updated && previousStatus !== "processing") {
          await insertStateEvent(tx, updated, previousStatus, "processing", "provider_still_processing");
        }
      });
      return;
    }
    if (!resolveVerifiedFinalStatus(payout, attempt, receipt)) {
      await markUncertain(payout.id);
      return;
    }
    await settlePayout(payout.id, attempt.id, receipt);
  } catch {
    await markUncertain(payout.id);
  }
}

export async function createAndDispatchPayout(input: PayoutExecutionInput) {
  const result = await preparePayout(input);
  if (result.kind !== "created" && result.kind !== "existing") return result;
  if (result.payout.status === "funds_reserved") await dispatchPayout(result.payout.id);
  return { kind: result.kind, payout: result.payout };
}
