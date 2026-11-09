import {
  and,
  customerIdentityRequestsTable,
  db,
  eq,
  gte,
  lt,
  paymentLimitsTable,
  sql,
  usersTable,
  walletLedgerTable,
} from "@workspace/db";
import {
  isMonthlyIncomingLimitReached,
  resolveMonthlyIncomingLimit,
} from "../services/payment-limits-policy";
import { getUtcMonthRange } from "../lib/account-limit-policy";
import { PAYMENT_LIMITS_ID } from "./payment-limits";

export async function getMonthlyIncomingPolicy(userId: string, now = new Date()) {
  if (!userId) throw new Error("Authenticated user is required");

  const { periodStart, periodEnd } = getUtcMonthRange(now);
  const [[user], [limits], [approvedIdentity], [receiptTotal]] = await Promise.all([
    db.select({
      monthlyIncomingLimitOverrideMinor: usersTable.monthlyIncomingLimitOverrideMinor,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select({
      unverifiedLimitMinor: paymentLimitsTable.maximumUnverifiedIncomingMinor,
      verifiedLimitMinor: paymentLimitsTable.maximumVerifiedIncomingMinor,
    }).from(paymentLimitsTable).where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).limit(1),
    db.select({ id: customerIdentityRequestsTable.id })
      .from(customerIdentityRequestsTable)
      .where(and(
        eq(customerIdentityRequestsTable.userId, userId),
        eq(customerIdentityRequestsTable.status, "approved"),
      ))
      .limit(1),
    db.select({
      total: sql<unknown>`coalesce(sum(${walletLedgerTable.amountMinor}), 0)`,
    }).from(walletLedgerTable).where(and(
      eq(walletLedgerTable.userId, userId),
      eq(walletLedgerTable.direction, "credit"),
      eq(walletLedgerTable.currency, "XOF"),
      sql`${walletLedgerTable.adminUserId} LIKE 'system:%'`,
      gte(walletLedgerTable.createdAt, periodStart),
      lt(walletLedgerTable.createdAt, periodEnd),
    )),
  ]);

  if (!user || !limits) throw new Error("Monthly incoming policy is unavailable");
  const receivedMinor = Number(receiptTotal?.total ?? 0);
  if (!Number.isSafeInteger(receivedMinor) || receivedMinor < 0) {
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
  const outgoingBlocked = isMonthlyIncomingLimitReached(receivedMinor, effectiveLimitMinor);
  const blockCode = outgoingBlocked
    ? !identityVerified && overrideMinor === null
      ? "identity_verification_required" as const
      : "monthly_incoming_limit_reached" as const
    : null;

  return {
    identityVerified,
    receivedMinor,
    unverifiedLimitMinor: limits.unverifiedLimitMinor,
    verifiedLimitMinor: limits.verifiedLimitMinor,
    overrideMinor,
    effectiveLimitMinor,
    outgoingBlocked,
    blockCode,
    periodStart,
    periodEnd,
  };
}

export function monthlyIncomingOutgoingBlockedMessage(
  policy: Pick<Awaited<ReturnType<typeof getMonthlyIncomingPolicy>>, "blockCode" | "effectiveLimitMinor">,
): string {
  if (policy.blockCode === "identity_verification_required") {
    return "Votre plafond mensuel avant validation de votre identité est atteint. Faites vérifier votre identité pour bénéficier du plafond mensuel validé. Les encaissements restent possibles. Aucun transfert n’a été lancé.";
  }

  return `Votre plafond mensuel d’encaissements de ${policy.effectiveLimitMinor.toLocaleString("fr-FR")} FCFA est atteint. Les encaissements restent possibles ; les sorties seront de nouveau disponibles au prochain mois. Aucun transfert n’a été lancé.`;
}
