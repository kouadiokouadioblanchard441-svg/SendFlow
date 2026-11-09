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
} from "@workspace/db";
import {
  CreateAdminWalletAdjustmentBody,
  DeleteAdminUserBody,
  GetAdminTransactionParams,
  GetAdminUserParams,
  ArchiveAdminTransactionBody,
  RestoreAdminUserBody,
  SuspendAdminUserBody,
  UpdateAdminUserMonthlyIncomingLimitBody,
  UpdateAdminUserMonthlyIncomingLimitResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { isTrustedOrigin } from "../lib/request-security";
import { respondAdminAuthError } from "./admin";
import { executeAdminWalletAdjustment, WalletAdjustmentError } from "../services/wallet-adjustment";

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
  if (error instanceof AdminActionError || error instanceof WalletAdjustmentError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  res.status(503).json({ error: "Administrator action storage unavailable" });
}

router.post("/users/:userId/wallet-adjustments", async (req, res): Promise<void> => {
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
  if (!Number.isSafeInteger(adjustment.amountMinor) || adjustment.amountMinor <= 0) {
    res.status(400).json({ error: "Adjustment amount is outside the safe integer range" });
    return;
  }

  try {
    const result = await executeAdminWalletAdjustment(adminUserId, userId, adjustment);

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
    if (error instanceof AdminActionError || error instanceof WalletAdjustmentError) {
      actionErrorResponse(res, error);
      return;
    }

    req.log.error({ err: error, userId }, "Admin wallet adjustment failed");
    res.status(503).json({ error: "Administrator action storage unavailable" });
  }
});

router.patch("/users/:userId/monthly-incoming-limit", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de la requête non autorisée." });
    return;
  }

  const parsedParams = GetAdminUserParams.safeParse(req.params);
  const parsedBody = UpdateAdminUserMonthlyIncomingLimitBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Vérifiez le plafond, la confirmation et le motif." });
    return;
  }

  const { userId } = parsedParams.data;
  const update = parsedBody.data;
  const reason = update.reason.trim();
  if (update.confirmation !== "CONFIRMER" || reason.length < 10) {
    res.status(400).json({ error: "Une confirmation et un motif détaillé sont requis." });
    return;
  }

  try {
    const changed = await db.transaction(async (tx) => {
      const [previous] = await tx.select({
        id: usersTable.id,
        status: usersTable.status,
        monthlyIncomingLimitOverrideMinor: usersTable.monthlyIncomingLimitOverrideMinor,
      }).from(usersTable).where(eq(usersTable.id, userId)).for("update").limit(1);
      if (!previous) throw new AdminActionError(404, "Utilisateur introuvable.");
      if (previous.status === "deleted") {
        throw new AdminActionError(409, "Le plafond d’un compte supprimé ne peut pas être modifié.");
      }
      if (previous.monthlyIncomingLimitOverrideMinor !== update.expectedMonthlyIncomingLimitOverrideMinor) {
        throw new AdminActionError(409, "Le plafond a changé dans une autre session. Actualisez la fiche.");
      }

      const [updated] = await tx.update(usersTable).set({
        monthlyIncomingLimitOverrideMinor: update.monthlyIncomingLimitOverrideMinor,
        updatedAt: new Date(),
      }).where(eq(usersTable.id, userId)).returning({
        id: usersTable.id,
        monthlyIncomingLimitOverrideMinor: usersTable.monthlyIncomingLimitOverrideMinor,
        updatedAt: usersTable.updatedAt,
      });
      if (!updated) throw new AdminActionError(409, "Le plafond n’a pas été enregistré.");

      await recordAdminAudit({
        adminUserId,
        action: "update_user_monthly_incoming_limit",
        resourceType: "user",
        resourceId: userId,
        reason: `${reason.slice(0, 360)} [plafond mensuel FCFA : ${previous.monthlyIncomingLimitOverrideMinor ?? "global"} → ${updated.monthlyIncomingLimitOverrideMinor ?? "global"}]`,
      }, tx);
      return updated;
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(UpdateAdminUserMonthlyIncomingLimitResponse.parse({
      userId: changed.id,
      monthlyIncomingLimitOverrideMinor: changed.monthlyIncomingLimitOverrideMinor,
      updatedAt: changed.updatedAt.toISOString(),
    }));
  } catch (error) {
    if (error instanceof AdminActionError) {
      actionErrorResponse(res, error);
      return;
    }
    req.log.error({ err: error, userId }, "Admin monthly incoming limit update failed");
    res.status(503).json({ error: "Le plafond utilisateur est momentanément indisponible." });
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
  if ((action === "suspend_user" || action === "delete_user") && userId === adminUserId) {
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

router.post("/users/:userId/suspend", (req, res) => {
  void applyUserAction(req, res, "suspend_user", req.body);
});

router.post("/users/:userId/restore", (req, res) => {
  void applyUserAction(req, res, "restore_user", req.body);
});

router.post("/users/:userId/delete", (req, res) => {
  void applyUserAction(req, res, "delete_user", req.body);
});

router.post("/transactions/:transactionId/archive", async (req, res): Promise<void> => {
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