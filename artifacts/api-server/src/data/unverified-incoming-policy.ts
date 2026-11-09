import {
  and,
  customerIdentityRequestsTable,
  db,
  eq,
  paymentLimitsTable,
  walletsTable,
} from "@workspace/db";
import { isUnverifiedOutgoingBlocked } from "../services/payment-limits-policy";
import { PAYMENT_LIMITS_ID } from "./payment-limits";

export async function getUnverifiedIncomingPolicy(userId: string) {
  if (!userId) throw new Error("Authenticated user is required");

  const [[wallet], [limits], [approvedIdentity]] = await Promise.all([
    db.select({
      unverifiedReceivedMinor: walletsTable.unverifiedReceivedMinor,
    }).from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1),
    db.select({
      maximumUnverifiedIncomingMinor: paymentLimitsTable.maximumUnverifiedIncomingMinor,
    }).from(paymentLimitsTable).where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).limit(1),
    db.select({ id: customerIdentityRequestsTable.id })
      .from(customerIdentityRequestsTable)
      .where(and(
        eq(customerIdentityRequestsTable.userId, userId),
        eq(customerIdentityRequestsTable.status, "approved"),
      ))
      .limit(1),
  ]);

  if (!wallet || !limits) throw new Error("Unverified incoming policy is unavailable");

  const identityVerified = Boolean(approvedIdentity);
  return {
    identityVerified,
    receivedMinor: wallet.unverifiedReceivedMinor,
    limitMinor: limits.maximumUnverifiedIncomingMinor,
    outgoingBlocked: isUnverifiedOutgoingBlocked(
      identityVerified,
      wallet.unverifiedReceivedMinor,
      limits.maximumUnverifiedIncomingMinor,
    ),
  };
}

export function unverifiedOutgoingBlockedMessage(limitMinor: number): string {
  return `Vous avez atteint le plafond de ${limitMinor.toLocaleString("fr-FR")} FCFA d’encaissements sans vérification d’identité. Faites vérifier votre identité pour effectuer un retrait ou un transfert. Les encaissements restent autorisés.`;
}
