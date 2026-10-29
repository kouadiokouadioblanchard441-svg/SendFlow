import { Router, type IRouter } from "express";
import {
  GetAdminPaymentLimitsResponse,
  GetPublicPaymentLimitsResponse,
  UpdateAdminPaymentLimitsBody,
  UpdateAdminPaymentLimitsResponse,
} from "@workspace/api-zod";
import { and, db, eq, paymentLimitsTable } from "@workspace/db";
import { recordAdminAudit } from "../lib/admin-audit";
import { isTrustedOrigin } from "../lib/request-security";
import { respondAdminAuthError } from "./admin";
import { isValidPaymentLimitValues } from "../services/payment-limits-policy";
import { PAYMENT_LIMITS_ID } from "../data/payment-limits";

const router: IRouter = Router();
export const adminRoutes: IRouter = Router();

function presentPublic(record: typeof paymentLimitsTable.$inferSelect) {
  return {
    currency: "XOF" as const,
    minimumDepositMinor: record.minimumDepositMinor,
    minimumPayoutMinor: record.minimumPayoutMinor,
    minimumInterNetworkMinor: record.minimumInterNetworkMinor,
    maximumTransferMinor: record.maximumTransferMinor,
    maximumPayinMinor: record.maximumPayinMinor,
  };
}

function presentAdmin(record: typeof paymentLimitsTable.$inferSelect) {
  return {
    ...presentPublic(record),
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function readCurrentRecord() {
  const [record] = await db.select().from(paymentLimitsTable)
    .where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).limit(1);
  if (!record) throw new Error("Payment limits have not been initialized");
  return record;
}

router.get("/payment-limits", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(GetPublicPaymentLimitsResponse.parse(presentPublic(await readCurrentRecord())));
  } catch (error) {
    req.log.error({ err: error }, "Public payment limits lookup failed");
    res.status(503).json({ error: "Les limites de paiement sont momentanément indisponibles." });
  }
});

adminRoutes.get("/payment-limits", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(GetAdminPaymentLimitsResponse.parse(presentAdmin(await readCurrentRecord())));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment limits lookup failed");
    res.status(503).json({ error: "Les limites de paiement sont momentanément indisponibles." });
  }
});

adminRoutes.patch("/payment-limits", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de la requête non autorisée." });
    return;
  }

  const parsed = UpdateAdminPaymentLimitsBody.safeParse(req.body);
  if (!parsed.success || parsed.data.reason.trim().length < 3
    || !isValidPaymentLimitValues({
      minimumDepositMinor: parsed.data.minimumDepositMinor,
      minimumPayoutMinor: parsed.data.minimumPayoutMinor,
      minimumInterNetworkMinor: parsed.data.minimumInterNetworkMinor,
      maximumTransferMinor: parsed.data.maximumTransferMinor,
      maximumPayinMinor: parsed.data.maximumPayinMinor,
    })) {
    res.status(400).json({ error: "Vérifiez les seuils et leurs plafonds avant l’enregistrement." });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(paymentLimitsTable)
        .where(eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID)).for("update");
      if (!previous || previous.version !== parsed.data.expectedVersion) return null;
      const [setting] = await tx.update(paymentLimitsTable).set({
        minimumDepositMinor: parsed.data.minimumDepositMinor,
        minimumPayoutMinor: parsed.data.minimumPayoutMinor,
        minimumInterNetworkMinor: parsed.data.minimumInterNetworkMinor,
        maximumTransferMinor: parsed.data.maximumTransferMinor,
        maximumPayinMinor: parsed.data.maximumPayinMinor,
        version: parsed.data.expectedVersion + 1,
        updatedAt: new Date(),
        updatedBy: adminUserId,
      }).where(and(
        eq(paymentLimitsTable.id, PAYMENT_LIMITS_ID),
        eq(paymentLimitsTable.version, parsed.data.expectedVersion),
      )).returning();
      if (!setting) return null;

      await recordAdminAudit({
        adminUserId,
        action: "update_payment_limits",
        resourceType: "payment_limits",
        resourceId: PAYMENT_LIMITS_ID,
        reason: `${parsed.data.reason.trim().slice(0, 400)} [seuils mis à jour; v${previous.version} → v${setting.version}]`,
      }, tx);
      return setting;
    });

    if (!updated) {
      res.status(409).json({ error: "Les limites ont été modifiées par une autre session. Actualisez la page." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(UpdateAdminPaymentLimitsResponse.parse(presentAdmin(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment limits update failed");
    res.status(503).json({ error: "Les limites de paiement sont momentanément indisponibles." });
  }
});

export default router;
