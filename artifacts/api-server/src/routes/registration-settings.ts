import { Router, type IRouter } from "express";
import { and, db, eq, registrationSettingsTable } from "@workspace/db";
import {
  GetAdminRegistrationSettingsResponse,
  GetRegistrationSettingsResponse,
  UpdateAdminRegistrationSettingsBody,
  UpdateAdminRegistrationSettingsResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { respondAdminAuthError } from "./admin";
import { isTrustedOrigin } from "../lib/request-security";

const router: IRouter = Router();
const adminRoutes: IRouter = Router();
const SETTING_ID = "signup";

function present(row: typeof registrationSettingsTable.$inferSelect) {
  return {
    smsVerificationEnabled: row.smsVerificationEnabled,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/auth/registration-settings", async (req, res): Promise<void> => {
  try {
    const [setting] = await db.select().from(registrationSettingsTable)
      .where(eq(registrationSettingsTable.id, SETTING_ID)).limit(1);
    if (!setting) throw new Error("Signup setting is missing");
    res.setHeader("Cache-Control", "no-store");
    res.json(GetRegistrationSettingsResponse.parse({ smsVerificationEnabled: setting.smsVerificationEnabled }));
  } catch (error) {
    req.log.error({ err: error }, "Registration settings lookup failed");
    res.status(503).json({ error: "Le réglage d'inscription est indisponible." });
  }
});

adminRoutes.get("/registration-settings", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;
  try {
    const [setting] = await db.select().from(registrationSettingsTable)
      .where(eq(registrationSettingsTable.id, SETTING_ID)).limit(1);
    if (!setting) throw new Error("Signup setting is missing");
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminRegistrationSettingsResponse.parse(present(setting)));
  } catch (error) {
    req.log.error({ err: error }, "Admin registration settings lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

adminRoutes.patch("/registration-settings", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;
  if (!isTrustedOrigin(req)) {
    res.status(403).json({ error: "Untrusted request origin" });
    return;
  }

  const parsed = UpdateAdminRegistrationSettingsBody.safeParse(req.body);
  if (!parsed.success || parsed.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid setting or audit reason" });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(registrationSettingsTable)
        .where(eq(registrationSettingsTable.id, SETTING_ID)).for("update");
      if (!previous || previous.version !== parsed.data.expectedVersion) return null;
      const [setting] = await tx.update(registrationSettingsTable).set({
        smsVerificationEnabled: parsed.data.smsVerificationEnabled,
        version: parsed.data.expectedVersion + 1,
        updatedAt: new Date(),
        updatedBy: adminUserId,
      }).where(and(
        eq(registrationSettingsTable.id, SETTING_ID),
        eq(registrationSettingsTable.version, parsed.data.expectedVersion),
      )).returning();
      if (!setting) return null;
      await recordAdminAudit({
        adminUserId,
        action: "update_registration_settings",
        resourceType: "registration_settings",
        resourceId: SETTING_ID,
        reason: `${parsed.data.reason.trim().slice(0, 400)} [SMS ${previous.smsVerificationEnabled ? "on" : "off"} → ${setting.smsVerificationEnabled ? "on" : "off"}; v${previous.version} → v${setting.version}]`,
      }, tx);
      return setting;
    });
    if (!updated) {
      res.status(409).json({ error: "Le réglage a changé. Actualisez la page." });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(UpdateAdminRegistrationSettingsResponse.parse(present(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin registration settings update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export { adminRoutes };
export default router;