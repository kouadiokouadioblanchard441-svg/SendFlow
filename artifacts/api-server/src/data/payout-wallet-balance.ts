import {
  db,
  eq,
  sql,
  usersTable,
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
  const [wallet] = await db.select({
    id: walletsTable.id,
    balanceMinor: walletsTable.balanceMinor,
    currency: walletsTable.currency,
    status: walletsTable.status,
    accountStatus: usersTable.status,
    paymentReservedMinor: sql<string>`coalesce((
      SELECT sum(r.amount_minor)
      FROM public.sf_wallet_payment_reservations AS r
      WHERE r.wallet_id = ${walletsTable.id}
        AND r.state = 'active'
        AND r.currency = 'XOF'
    ), 0)::text`,
    payoutReservedMinor: sql<string>`coalesce((
      SELECT sum(p.total_debit_minor)
      FROM public.sf_payout_requests AS p
      WHERE p.wallet_id = ${walletsTable.id}
        AND p.reservation_state = 'active'
        AND p.currency = 'XOF'
    ), 0)::text`,
  }).from(usersTable)
    .innerJoin(walletsTable, eq(walletsTable.userId, usersTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!wallet || wallet.accountStatus !== "active") {
    throw new PayoutPolicyError(403, "Le compte SendFlow n’est pas actif.");
  }
  if (wallet.status !== "active" || wallet.currency !== "XOF") {
    throw new PayoutPolicyError(403, "Le portefeuille SendFlow n’est pas disponible pour ce versement.");
  }

  const balanceMinor = wallet.balanceMinor;
  const paymentReservedMinor = parseMinorTotal(wallet.paymentReservedMinor);
  const payoutReservedMinor = parseMinorTotal(wallet.payoutReservedMinor);
  const reservedMinor = paymentReservedMinor + payoutReservedMinor;
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

