import { Router, type IRouter } from "express";
import {
  and,
  db,
  eq,
  operatorOtpPoliciesTable,
} from "@workspace/db";
import {
  ListAdminOtpPoliciesResponse,
  UpdateAdminOtpPolicyBody,
  UpdateAdminOtpPolicyParams,
  UpdateAdminOtpPolicyResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

const policyCatalog = [
  { countryCode: "ci", countryName: "Côte d’Ivoire", operatorId: "orange-ci", operatorName: "Orange Money", phonePrefix: "+225" },
  { countryCode: "bf", countryName: "Burkina Faso", operatorId: "orange-bf", operatorName: "Orange Money", phonePrefix: "+226" },
  { countryCode: "ml", countryName: "Mali", operatorId: "orange-ml", operatorName: "Orange Money", phonePrefix: "+223" },
  { countryCode: "sn", countryName: "Sénégal", operatorId: "orange-sn", operatorName: "Orange Money", phonePrefix: "+221" },
] as const;

type PolicyCatalogEntry = (typeof policyCatalog)[number];

function findCatalogEntry(countryCode: string, operatorId: string): PolicyCatalogEntry | undefined {
  return policyCatalog.find((item) => item.countryCode === countryCode && item.operatorId === operatorId);
}

function toAdminOtpPolicy(catalogEntry: PolicyCatalogEntry, stored?: typeof operatorOtpPoliciesTable.$inferSelect) {
  return {
    countryCode: catalogEntry.countryCode,
    countryName: catalogEntry.countryName,
    operatorId: catalogEntry.operatorId,
    operatorName: catalogEntry.operatorName,
    phonePrefix: catalogEntry.phonePrefix,
    requiresOtp: stored?.requiresOtp ?? true,
    providerStatus: "not_configured" as const,
    version: stored?.version ?? 0,
    updatedAt: stored?.updatedAt?.toISOString() ?? null,
  };
}

router.get("/admin/otp-policies", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  try {
    const rows = await db.select().from(operatorOtpPoliciesTable);
    const rowsByKey = new Map(rows.map((row) => [`${row.countryCode}:${row.operatorId}`, row]));
    const items = policyCatalog.map((entry) =>
      toAdminOtpPolicy(entry, rowsByKey.get(`${entry.countryCode}:${entry.operatorId}`)),
    );

    await recordAdminAudit({
      adminUserId,
      action: "view_otp_policies",
      resourceType: "otp_policy",
      resourceId: "orange-money",
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(ListAdminOtpPoliciesResponse.parse({ items }));
  } catch (error) {
    req.log.error({ err: error }, "Admin OTP policy list lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.patch("/admin/otp-policies/:countryCode/:operatorId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const params = UpdateAdminOtpPolicyParams.safeParse(req.params);
  const body = UpdateAdminOtpPolicyBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid OTP policy data or audit reason" });
    return;
  }

  const { countryCode, operatorId } = params.data;
  const catalogEntry = findCatalogEntry(countryCode, operatorId);
  if (!catalogEntry) {
    res.status(404).json({ error: "Unsupported country and operator combination" });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const keyMatch = and(
        eq(operatorOtpPoliciesTable.countryCode, countryCode),
        eq(operatorOtpPoliciesTable.operatorId, operatorId),
      );
      let [policy] = await tx
        .update(operatorOtpPoliciesTable)
        .set({
          requiresOtp: body.data.requiresOtp,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(and(keyMatch, eq(operatorOtpPoliciesTable.version, body.data.expectedVersion)))
        .returning();

      if (!policy && body.data.expectedVersion === 0) {
        [policy] = await tx
          .insert(operatorOtpPoliciesTable)
          .values({
            countryCode,
            operatorId,
            requiresOtp: body.data.requiresOtp,
            version: 1,
            createdBy: adminUserId,
            updatedBy: adminUserId,
          })
          .onConflictDoNothing()
          .returning();
      }

      if (!policy) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "update_otp_policy",
        resourceType: "otp_policy",
        resourceId: `${countryCode}:${operatorId}`,
        reason: body.data.reason.trim(),
      }, tx);

      return policy;
    });

    if (!updated) {
      res.status(409).json({ error: "OTP policy changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminOtpPolicyResponse.parse(toAdminOtpPolicy(catalogEntry, updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin OTP policy update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;