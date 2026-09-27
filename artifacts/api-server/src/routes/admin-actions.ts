import { Router, type IRouter } from "express";
import {
  and,
  customerSessionsTable,
  db,
  eq,
  isNull,
  adminAuditLogsTable,
  transactionsTable,
  usersTable,
  walletsTable,
  walletLedgerTable,
} from "@workspace/db";
import {
  CreateAdminWalletAdjustmentBody,
  DeleteAdminUserBody,
  GetAdminTransactionParams,
  GetAdminUserParams,
  ArchiveAdminTransactionBody,
  RestoreAdminUserBody,
  SuspendAdminUserBody,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

class AdminActionError extends Error {
  constructor(
    public readonly statusCode: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

function actionErrorResponse(res: Parameters<Parameters<IRouter["post"]>[1]>[1], error: unknown) {
  if (error instanceof AdminActionError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  res.status(503).json({ error: "Administrator action storage unavailable" });
}

function isConfiguredAdminUser(userId: string) {
  return [
    process.env.SENDFLOW_ADMIN_USER_IDS,
    process.env.SENDFLOW_MUTATION_ADMIN_USER_IDS,
  ].some((configuredIds) =>
    (configuredIds ?? "").split(",").some((configuredId) => configuredId.trim() === userId)
  );
}

router.post("/admin/users/:userId/wallet-adjustments", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const parsedParams = GetAdminUserParams.safeParse(req.params);
  const parsedBody = CreateAdminWalletAdjustmentBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid wallet adjustment request" });
    return;
  }

  const { userId } = parsedParams.data;
  const adjustment = { ...parsedBody.data, reason: parsedBody.data.reason.trim() };
  if (adjustment.confirmation !== adjustment.direction.toUpperCase()) {
    res.status(400).json({ error: "Confirmation does not match the wallet adjustment direction" });
    return;
  }
  if (adjustment.reason.length < 10) {
    res.status(400).json({ error: "A meaningful reason of at least 10 non-whitespace characters is required" });
    return;
  }
  if (!Number.isSafeInteger(adjustment.expectedBalanceMinor) || adjustment.expectedBalanceMinor < 0) {
    res.status(400).json({ error: "A valid expected wallet balance is required" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");

      if (!user) throw new AdminActionError(404, "User not found");
      if (user.status === "deleted") throw new AdminActionError(400, "Deleted users cannot receive wallet adjustments");

      const [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .for("update");

      if (!wallet) throw new AdminActionError(404, "Wallet not found");
      if (wallet.status !== "active") throw new AdminActionError(400, "Wallet is not active");

      const [existing] = await tx
        .select()
        .from(walletLedgerTable)
        .where(eq(walletLedgerTable.idempotencyKey, adjustment.idempotencyKey));

      if (existing) {
        if (
          existing.userId !== userId
          || existing.direction !== adjustment.direction
          || existing.amountMinor !== adjustment.amountMinor
          || existing.reason !== adjustment.reason
          || existing.adminUserId !== adminUserId
        ) {
          throw new AdminActionError(409, "Idempotency key belongs to another wallet adjustment");
        }

        return { entry: existing, duplicate: true };
      }

      if (!Number.isSafeInteger(wallet.balanceMinor) || wallet.balanceMinor < 0) {
        throw new AdminActionError(409, "Wallet balance is outside the supported safe range");
      }

      if (adjustment.expectedBalanceMinor !== wallet.balanceMinor) {
        throw new AdminActionError(409, "Wallet balance changed; refresh before retrying");
      }

      if (!Number.isSafeInteger(adjustment.amountMinor) || adjustment.amountMinor <= 0) {
        throw new AdminActionError(400, "Adjustment amount is outside the safe integer range");
      }

      const balanceBeforeMinor = wallet.balanceMinor;
      const balanceAfterMinor = adjustment.direction === "credit"
        ? balanceBeforeMinor + adjustment.amountMinor
        : balanceBeforeMinor - adjustment.amountMinor;

      if (!Number.isSafeInteger(balanceAfterMinor)) {
        throw new AdminActionError(400, "Resulting wallet balance is outside the safe integer range");
      }
      if (balanceAfterMinor < 0) {
        throw new AdminActionError(400, "Wallet balance cannot become negative");
      }

      const [entry] = await tx
        .insert(walletLedgerTable)
        .values({
          walletId: wallet.id,
          userId,
          direction: adjustment.direction,
          amountMinor: adjustment.amountMinor,
          balanceBeforeMinor,
          balanceAfterMinor,
          currency: wallet.currency,
          reason: adjustment.reason,
          adminUserId,
          idempotencyKey: adjustment.idempotencyKey,
        })
        .returning();

      if (!entry) throw new Error("Wallet ledger entry was not created");

      await tx
        .update(walletsTable)
        .set({ balanceMinor: balanceAfterMinor, updatedAt: new Date() })
        .where(eq(walletsTable.id, wallet.id));

      await recordAdminAudit({
        adminUserId,
        action: adjustment.direction === "credit" ? "credit_wallet" : "debit_wallet",
        resourceType: "wallet",
        resourceId: wallet.id,
        reason: adjustment.reason,
        amountMinor: adjustment.amountMinor,
        currency: wallet.currency,
      }, tx);

      return { entry, duplicate: false };
    });

    res.status(result.duplicate ? 200 : 201).json({
      ledgerEntryId: result.entry.id,
      userId: result.entry.userId,
      walletId: result.entry.walletId,
      direction: result.entry.direction,
      amountMinor: result.entry.amountMinor,
      balanceBeforeMinor: result.entry.balanceBeforeMinor,
      balanceAfterMinor: result.entry.balanceAfterMinor,
      currency: result.entry.currency,
      duplicate: result.duplicate,
    });
  } catch (error) {
    if (error instanceof AdminActionError) {
      actionErrorResponse(res, error);
      return;
    }

    req.log.error({ err: error, userId }, "Admin wallet adjustment failed");
    res.status(503).json({ error: "Administrator action storage unavailable" });
  }
});

async function applyUserAction(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  res: Parameters<Parameters<IRouter["post"]>[1]>[1],
  action: "suspend_user" | "restore_user" | "delete_user",
  body: unknown,
) {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const parsedParams = GetAdminUserParams.safeParse(req.params);
  const parsedBody = action === "suspend_user"
    ? SuspendAdminUserBody.safeParse(body)
    : action === "restore_user"
      ? RestoreAdminUserBody.safeParse(body)
      : DeleteAdminUserBody.safeParse(body);

  if (!parsedParams.success || !parsedBody.success || parsedBody.data.confirmation !== "CONFIRMER") {
    res.status(400).json({ error: "Invalid administrator user action request" });
    return;
  }

  const { userId } = parsedParams.data;
  const reason = parsedBody.data.reason.trim();
  if (reason.length < 10) {
    res.status(400).json({ error: "A meaningful reason of at least 10 non-whitespace characters is required" });
    return;
  }
  if ((action === "suspend_user" || action === "delete_user") && isConfiguredAdminUser(userId)) {
    res.status(409).json({ error: "Administrator accounts cannot be suspended or deleted from this panel" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: usersTable.id, status: usersTable.status })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update");

      if (!user) throw new AdminActionError(404, "User not found");
      if (action === "suspend_user" && user.status === "deleted") {
        throw new AdminActionError(400, "Deleted users cannot be suspended");
      }
      if (action === "restore_user" && user.status === "deleted") {
        throw new AdminActionError(400, "Deleted users cannot be restored by this action");
      }
      if (action === "suspend_user" && user.status === "suspended") {
        throw new AdminActionError(400, "User is already suspended");
      }
      if (action === "restore_user" && user.status === "active") {
        throw new AdminActionError(400, "User is already active");
      }
      if (action === "delete_user" && user.status === "deleted") {
        throw new AdminActionError(400, "User is already deleted");
      }

      const now = new Date();
      const nextStatus = action === "suspend_user" ? "suspended" : action === "restore_user" ? "active" : "deleted";
      const [updated] = await tx
        .update(usersTable)
        .set(
          action === "suspend_user"
            ? { status: nextStatus, suspendedAt: now, suspendedBy: adminUserId, suspensionReason: reason }
            : action === "restore_user"
              ? { status: nextStatus, suspendedAt: null, suspendedBy: null, suspensionReason: null }
              : { status: nextStatus, deletedAt: now, deletedBy: adminUserId, deletionReason: reason },
        )
        .where(eq(usersTable.id, userId))
        .returning({ id: usersTable.id });

      if (!updated) throw new Error("User status was not updated");

      if (action === "suspend_user" || action === "delete_user") {
        await tx
          .update(customerSessionsTable)
          .set({ revokedAt: now, pinVerifiedUntil: null })
          .where(
            and(
              eq(customerSessionsTable.userId, userId),
              isNull(customerSessionsTable.revokedAt),
            ),
          );
      }

      await recordAdminAudit({
        adminUserId,
        action,
        resourceType: "user",
        resourceId: userId,
        reason,
      }, tx);

      return { resourceId: userId, action, status: nextStatus };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof AdminActionError) {
      actionErrorResponse(res, error);
      return;
    }

    req.log.error({ err: error, userId, action }, "Admin user action failed");
    res.status(503).json({ error: "Administrator action storage unavailable" });
  }
}

router.post("/admin/users/:userId/suspend", (req, res) => {
  void applyUserAction(req, res, "suspend_user", req.body);
});

router.post("/admin/users/:userId/restore", (req, res) => {
  void applyUserAction(req, res, "restore_user", req.body);
});

router.post("/admin/users/:userId/delete", (req, res) => {
  void applyUserAction(req, res, "delete_user", req.body);
});

router.post("/admin/transactions/:transactionId/archive", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const parsedParams = GetAdminTransactionParams.safeParse(req.params);
  const parsedBody = ArchiveAdminTransactionBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success || parsedBody.data.confirmation !== "CONFIRMER") {
    res.status(400).json({ error: "Invalid administrator transaction action request" });
    return;
  }

  const { transactionId } = parsedParams.data;
  const reason = parsedBody.data.reason.trim();
  if (reason.length < 10) {
    res.status(400).json({ error: "A meaningful reason of at least 10 non-whitespace characters is required" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select({ id: transactionsTable.id, deletedAt: transactionsTable.deletedAt })
        .from(transactionsTable)
        .where(and(eq(transactionsTable.id, transactionId), isNull(transactionsTable.deletedAt)))
        .for("update");

      if (!transaction) throw new AdminActionError(404, "Transaction not found");

      const [updated] = await tx
        .update(transactionsTable)
        .set({
          deletedAt: new Date(),
          deletedBy: adminUserId,
          deletionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(transactionsTable.id, transactionId))
        .returning({ id: transactionsTable.id });

      if (!updated) throw new Error("Transaction was not archived");

      await recordAdminAudit({
        adminUserId,
        action: "archive_transaction",
        resourceType: "transaction",
        resourceId: transactionId,
        reason,
      }, tx);

      return { resourceId: transactionId, action: "archive_transaction", status: "archived" };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof AdminActionError) {
      actionErrorResponse(res, error);
      return;
    }

    req.log.error({ err: error, transactionId }, "Admin transaction archive failed");
    res.status(503).json({ error: "Administrator action storage unavailable" });
  }
});

export default router;