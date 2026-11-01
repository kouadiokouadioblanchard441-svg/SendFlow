import { and, db, eq, customerServiceSettingsTable } from "@workspace/db";
import {
  GetAdminCustomerServiceSettingsResponse,
  GetCustomerServiceSettingsResponse,
  UpdateAdminCustomerServiceSettingsBody,
  UpdateAdminCustomerServiceSettingsResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import { recordAdminAudit } from "../lib/admin-audit";
import { isTrustedOrigin } from "../lib/request-security";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();
export const adminRoutes: IRouter = Router();
const SETTINGS_ID = "global";

function present(row: typeof customerServiceSettingsTable.$inferSelect) {
  return {
    phoneNumber: row.phoneNumber,
    whatsappNumber: row.whatsappNumber,
    facebookLabel: row.facebookLabel,
    facebookUrl: row.facebookUrl,
  };
}

function presentAdmin(row: typeof customerServiceSettingsTable.$inferSelect) {
  return {
    ...present(row),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function readCurrentSettings() {
  const [settings] = await db.select().from(customerServiceSettingsTable)
    .where(eq(customerServiceSettingsTable.id, SETTINGS_ID)).limit(1);
  if (!settings) throw new Error("Customer service settings are not initialized");
  return settings;
}

router.get("/customer-service-settings", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(GetCustomerServiceSettingsResponse.parse(present(await readCurrentSettings())));
  } catch (error) {
    req.log.error({ err: error }, "Customer service settings lookup failed");
    res.status(503).json({ error: "Les coordonnées du service client sont momentanément indisponibles." });
  }
});

adminRoutes.get("/customer-service-settings", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    res.json(GetAdminCustomerServiceSettingsResponse.parse(presentAdmin(await readCurrentSettings())));
  } catch (error) {
    req.log.error({ err: error }, "Admin customer service settings lookup failed");
    res.status(503).json({ error: "Les coordonnées du service client sont momentanément indisponibles." });
  }
});

adminRoutes.patch("/customer-service-settings", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Origine de la requête non autorisée." });
    return;
  }

  const parsed = UpdateAdminCustomerServiceSettingsBody.safeParse(req.body);
  if (!parsed.success || parsed.data.reason.trim().length < 3
    || (!parsed.data.phoneNumber?.trim() && !parsed.data.whatsappNumber?.trim())
    || Boolean(parsed.data.facebookLabel) !== Boolean(parsed.data.facebookUrl)) {
    res.status(400).json({ error: "Vérifiez les coordonnées et le motif de modification." });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(customerServiceSettingsTable)
        .where(eq(customerServiceSettingsTable.id, SETTINGS_ID)).for("update");
      if (!previous || previous.version !== parsed.data.expectedVersion) return null;
      const [setting] = await tx.update(customerServiceSettingsTable).set({
        phoneNumber: parsed.data.phoneNumber?.trim() || null,
        whatsappNumber: parsed.data.whatsappNumber?.trim() || null,
        facebookLabel: parsed.data.facebookLabel?.trim() || null,
        facebookUrl: parsed.data.facebookUrl?.trim() || null,
        version: parsed.data.expectedVersion + 1,
        updatedAt: new Date(),
        updatedBy: adminUserId,
      }).where(and(
        eq(customerServiceSettingsTable.id, SETTINGS_ID),
        eq(customerServiceSettingsTable.version, parsed.data.expectedVersion),
      )).returning();
      if (!setting) return null;

      await recordAdminAudit({
        adminUserId,
        action: "update_customer_service_settings",
        resourceType: "customer_service_settings",
        resourceId: SETTINGS_ID,
        reason: `${parsed.data.reason.trim().slice(0, 400)} [coordonnées mises à jour; v${previous.version} → v${setting.version}]`,
      }, tx);
      return setting;
    });

    if (!updated) {
      res.status(409).json({ error: "Les coordonnées ont changé. Actualisez la page avant de réessayer." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(UpdateAdminCustomerServiceSettingsResponse.parse(presentAdmin(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin customer service settings update failed");
    res.status(503).json({ error: "Les coordonnées du service client n’ont pas pu être enregistrées." });
  }
});

export default router;
