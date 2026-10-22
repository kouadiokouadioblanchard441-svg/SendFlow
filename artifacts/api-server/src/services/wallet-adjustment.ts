import { db, eq, usersTable, walletsTable, walletLedgerTable } from "@workspace/db";
import { recordAdminAudit } from "../lib/admin-audit";

export class WalletAdjustmentError extends Error {
  readonly statusCode: 400 | 404 | 409;
  constructor(statusCode: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "WalletAdjustmentError";
    this.statusCode = statusCode;
  }
}

type Adjustment = {
  direction: "credit" | "debit";
  amountMinor: number;
  expectedBalanceMinor: number;
  reason: string;
  idempotencyKey: string;
};

/** Internal service: its caller must supply the server-authorized administrator.
 * No HTTP route is added and the existing administrator gate remains closed.
 */
export async function executeAdminWalletAdjustment(
  adminUserId: string, userId: string, request: Adjustment,
) {
  const adjustment = { ...request, reason: request.reason.trim() };
  if (!adminUserId || !userId || !["credit", "debit"].includes(adjustment.direction)
    || adjustment.reason.length < 10 || adjustment.reason.length > 500
    || !adjustment.idempotencyKey || adjustment.idempotencyKey.length > 128
    || !Number.isSafeInteger(adjustment.expectedBalanceMinor) || adjustment.expectedBalanceMinor < 0
    || !Number.isSafeInteger(adjustment.amountMinor) || adjustment.amountMinor <= 0) {
    throw new WalletAdjustmentError(400, "Invalid wallet adjustment");
  }
  return db.transaction(async (tx) => {
    const [user] = await tx.select({ id: usersTable.id, status: usersTable.status })
      .from(usersTable).where(eq(usersTable.id, userId)).for("update");
    if (!user) throw new WalletAdjustmentError(404, "User not found");
    if (user.status !== "active") throw new WalletAdjustmentError(400, "User is not active");
    const [wallet] = await tx.select().from(walletsTable)
      .where(eq(walletsTable.userId, userId)).for("update");
    if (!wallet) throw new WalletAdjustmentError(404, "Wallet not found");
    if (wallet.status !== "active") throw new WalletAdjustmentError(400, "Wallet is not active");
    const [existing] = await tx.select().from(walletLedgerTable)
      .where(eq(walletLedgerTable.idempotencyKey, adjustment.idempotencyKey));
    if (existing) {
      if (existing.userId !== userId || existing.walletId !== wallet.id
        || existing.direction !== adjustment.direction || existing.amountMinor !== adjustment.amountMinor
        || existing.reason !== adjustment.reason || existing.adminUserId !== adminUserId
        || existing.currency !== wallet.currency
        || existing.balanceBeforeMinor !== adjustment.expectedBalanceMinor
        || !Number.isSafeInteger(existing.balanceAfterMinor)
        || existing.balanceAfterMinor !== (existing.direction === "credit"
          ? existing.balanceBeforeMinor + existing.amountMinor
          : existing.balanceBeforeMinor - existing.amountMinor)) {
        throw new WalletAdjustmentError(409, "Idempotency key belongs to another wallet adjustment");
      }
      return { entry: existing, duplicate: true };
    }
    if (!Number.isSafeInteger(wallet.balanceMinor) || wallet.balanceMinor < 0) {
      throw new WalletAdjustmentError(409, "Wallet balance is outside the supported safe range");
    }
    if (adjustment.expectedBalanceMinor !== wallet.balanceMinor) {
      throw new WalletAdjustmentError(409, "Wallet balance changed; refresh before retrying");
    }
    const balanceBeforeMinor = wallet.balanceMinor;
    const balanceAfterMinor = adjustment.direction === "credit"
      ? balanceBeforeMinor + adjustment.amountMinor : balanceBeforeMinor - adjustment.amountMinor;
    if (!Number.isSafeInteger(balanceAfterMinor)) {
      throw new WalletAdjustmentError(400, "Resulting wallet balance is outside the safe integer range");
    }
    if (balanceAfterMinor < 0) throw new WalletAdjustmentError(400, "Wallet balance cannot become negative");
    const [entry] = await tx.insert(walletLedgerTable).values({
      walletId: wallet.id, userId, direction: adjustment.direction,
      amountMinor: adjustment.amountMinor, balanceBeforeMinor, balanceAfterMinor,
      currency: wallet.currency, reason: adjustment.reason, adminUserId,
      idempotencyKey: adjustment.idempotencyKey,
    }).returning();
    if (!entry) throw new Error("Wallet ledger entry was not created");
    await tx.update(walletsTable).set({ balanceMinor: balanceAfterMinor, updatedAt: new Date() })
      .where(eq(walletsTable.id, wallet.id));
    await recordAdminAudit({
      adminUserId, action: adjustment.direction === "credit" ? "credit_wallet" : "debit_wallet",
      resourceType: "wallet", resourceId: wallet.id, reason: adjustment.reason,
      amountMinor: adjustment.amountMinor, currency: wallet.currency,
    }, tx);
    return { entry, duplicate: false };
  });
}
