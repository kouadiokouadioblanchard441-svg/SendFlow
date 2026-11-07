import {
  and,
  db,
  eq,
  payoutRequestsTable,
  sql,
  userAccountStatusEnum,
  usersTable,
  walletPaymentReservationsTable,
  walletsTable,
} from "@workspace/db";
import { PayoutPolicyError } from "../services/payout-policy";

export type PayoutWalletSnapshot = {
  walletId: string;
  balanceMinor: number;
  reservedMinor: number;
  availableMinor: number;
};

function parseMinorTotal(value: string | null | undefined): number {
  const parsed = Number(value ?? "0");
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new PayoutPolicyError(503, "Le solde SendFlow est momentanément indisponible.");
  }
  return parsed;
}

export async function loadMerchantPayoutWallet(userId: string): Promise<PayoutWalletSnapshot> {
  const [account] = await db.select({ status: usersTable.status })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!account || account.status !== userAccountStatusEnum.enumValues[0]) {
    throw new PayoutPolicyError(403, "Le compte SendFlow n’est pas actif.");
  }

  const [wallet] = await db.select({
    id: walletsTable.id,
    balanceMinor: walletsTable.balanceMinor,
    currency: walletsTable.currency,
    status: walletsTable.status,
  }).from(walletsTable)
    .where(eq(walletsTable.userId, userId))
    .limit(1);
  if (!wallet || wallet.status !== "active" || wallet.currency !== "XOF") {
    throw new PayoutPolicyError(403, "Le portefeuille SendFlow n’est pas disponible pour ce versement.");
  }

  const [paymentReservations] = await db.select({
    amountMinor: sql<string>`coalesce(sum(${walletPaymentReservationsTable.amountMinor}), 0)::text`,
  }).from(walletPaymentReservationsTable)
    .where(and(
      eq(walletPaymentReservationsTable.walletId, wallet.id),
      eq(walletPaymentReservationsTable.state, "active"),
      eq(walletPaymentReservationsTable.currency, "XOF"),
    ));
  const [payoutReservations] = await db.select({
    amountMinor: sql<string>`coalesce(sum(${payoutRequestsTable.totalDebitMinor}), 0)::text`,
  }).from(payoutRequestsTable)
    .where(and(
      eq(payoutRequestsTable.walletId, wallet.id),
      eq(payoutRequestsTable.reservationState, "active"),
      eq(payoutRequestsTable.currency, "XOF"),
    ));

  const balanceMinor = wallet.balanceMinor;
  const reservedMinor = parseMinorTotal(paymentReservations?.amountMinor)
    + parseMinorTotal(payoutReservations?.amountMinor);
  if (!Number.isSafeInteger(balanceMinor) || balanceMinor < 0
    || !Number.isSafeInteger(reservedMinor) || reservedMinor > balanceMinor) {
    throw new PayoutPolicyError(503, "Le solde disponible SendFlow est momentanément indisponible.");
  }
  return {
    walletId: wallet.id,
    balanceMinor,
    reservedMinor,
    availableMinor: balanceMinor - reservedMinor,
  };
}

