import {
  and,
  customerIdentityRequestsTable,
  db,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  paymentLimitsTable,
  paymentIntentsTable,
  sql,
  transactionsTable,
  usersTable,
  walletLedgerTable,
} from "@workspace/db";
import {
  isMonthlyIncomingLimitReached,
  resolveMonthlyIncomingLimit,
} from "../services/payment-limits-policy";
import { getUtcMonthRange } from "../lib/account-limit-policy";
import { PAYMENT_LIMITS_ID } from "./payment-limits";

type MonthlyIncomingReader = Pick<typeof db, "select">;
const pendingIncomingIntentStates = ["created", "collecting", "uncertain", "succeeded"] as const;

export async function getMonthlyIncomingPolicy(
  userId: string,
  now = new Date(),
  reader: MonthlyIncomingReader = db,
) {
  if (!userId) throw new Error("Authenticated user is required");

  const { periodStart, periodEnd } = getUtcMonthRange(now);
  const [[user], [limits], [approvedIdentity], [receiptTotal], [pendingTotal]] = await Promise.all([
    reader.select({
      monthlyIncomingLimitOverrideMinor: usersTable.monthlyIncomingLimitOverrideMinor,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    reader.select({
      unverifiedLimitMinor: paymentLimitsTable.maximumUnverifiedIncomingMinor,
      verifiedLimitMinor: paymentLimitsTable.maximumVerifiedIncomingMinor,
    }).from(paymentLimitsTable).where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).limit(1),
    reader.select({ id: customerIdentityRequestsTable.id })
      .from(customerIdentityRequestsTable)
      .where(and(
        eq(customerIdentityRequestsTable.userId, userId),
        eq(customerIdentityRequestsTable.status, "approved"),
      ))
      .limit(1),
    reader.select({
      total: sql<unknown>`coalesce(sum(${walletLedgerTable.amountMinor}), 0)`,
    }).from(walletLedgerTable).where(and(
      eq(walletLedgerTable.userId, userId),
      eq(walletLedgerTable.direction, "credit"),
      eq(walletLedgerTable.currency, "XOF"),
      sql`${walletLedgerTable.adminUserId} LIKE 'system:%'`,
      gte(walletLedgerTable.createdAt, periodStart),
      lt(walletLedgerTable.createdAt, periodEnd),
    )),
    reader.select({
      total: sql<unknown>`coalesce(sum(${paymentIntentsTable.recipientTotalMinor}), 0)`,
    }).from(paymentIntentsTable)
      .innerJoin(transactionsTable, eq(paymentIntentsTable.transactionId, transactionsTable.id))
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.kind, "deposit"),
        eq(transactionsTable.status, "pending"),
        eq(paymentIntentsTable.kind, "deposit"),
        eq(paymentIntentsTable.currency, "XOF"),
        inArray(paymentIntentsTable.state, pendingIncomingIntentStates),
        isNull(paymentIntentsTable.ledgerEntryId),
      )),
  ]);

  if (!user || !limits) throw new Error("Monthly incoming policy is unavailable");
  const receivedMinor = Number(receiptTotal?.total ?? 0);
  const pendingReservedMinor = Number(pendingTotal?.total ?? 0);
  const committedMinor = receivedMinor + pendingReservedMinor;
  if (!Number.isSafeInteger(receivedMinor) || receivedMinor < 0
    || !Number.isSafeInteger(pendingReservedMinor) || pendingReservedMinor < 0
    || !Number.isSafeInteger(committedMinor)) {
    throw new Error("Monthly incoming receipts are outside the safe integer range");
  }

  const identityVerified = Boolean(approvedIdentity);
  const overrideMinor = user.monthlyIncomingLimitOverrideMinor;
  const effectiveLimitMinor = resolveMonthlyIncomingLimit(
    identityVerified,
    overrideMinor,
    limits.unverifiedLimitMinor,
    limits.verifiedLimitMinor,
  );
  const incomingBlocked = isMonthlyIncomingLimitReached(committedMinor, effectiveLimitMinor);
  const blockCode = incomingBlocked
    ? !identityVerified && overrideMinor === null
      ? "identity_verification_required" as const
      : "monthly_incoming_limit_reached" as const
    : null;

  return {
    identityVerified,
    receivedMinor,
    pendingReservedMinor,
    committedMinor,
    unverifiedLimitMinor: limits.unverifiedLimitMinor,
    verifiedLimitMinor: limits.verifiedLimitMinor,
    overrideMinor,
    effectiveLimitMinor,
    incomingBlocked,
    limitReached: incomingBlocked,
    blockCode,
    periodStart,
    periodEnd,
  };
}

export function monthlyIncomingLimitReachedMessage(
  policy: Pick<Awaited<ReturnType<typeof getMonthlyIncomingPolicy>>, "blockCode" | "effectiveLimitMinor">,
): string {
  if (policy.blockCode === "identity_verification_required") {
    return "Votre plafond mensuel d’encaissement sans vérification d’identité est atteint. Les nouveaux encaissements sont suspendus. Vous pouvez retirer les fonds disponibles, sous réserve des contrôles habituels du compte. Une identité approuvée permet d’accéder au plafond supérieur.";
  }

  return `Votre plafond mensuel d’encaissement de ${policy.effectiveLimitMinor.toLocaleString("fr-FR")} FCFA est atteint. Les nouveaux encaissements sont suspendus jusqu’au renouvellement du mois ou à une modification autorisée. Les fonds disponibles restent retirables, sous réserve des contrôles habituels du compte.`;
}

export function merchantMonthlyLimitReachedMessage() {
  return "Ce marchand a atteint sa limite mensuelle d’encaissement. Veuillez le contacter pour en savoir plus.";
}
