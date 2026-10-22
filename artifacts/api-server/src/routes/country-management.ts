import { Router, type IRouter } from "express";
import {
  and,
  asc,
  db,
  eq,
  countriesTable,
} from "@workspace/db";
import {
  CountryCatalog,
  CreateAdminCountryBody,
  CreateAdminCountryResponse,
  GetAdminCountriesResponse,
  UpdateAdminCountryBody,
  UpdateAdminCountryParams,
  UpdateAdminCountryResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();
const adminRoutes: IRouter = Router();

function flagFromCountryCode(countryCode: string): string {
  if (!/^[a-z]{2}$/.test(countryCode)) return "";
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

function toCountry(country: typeof countriesTable.$inferSelect) {
  return {
    countryCode: country.countryCode,
    countryName: country.countryName,
    phonePrefix: country.phonePrefix,
    minPhoneDigits: country.minPhoneDigits,
    maxPhoneDigits: country.maxPhoneDigits,
    enabled: country.enabled,
    flag: flagFromCountryCode(country.countryCode),
    operations: {
      deposit: country.depositEnabled,
      interNetwork: country.interNetworkEnabled,
      international: country.internationalEnabled,
    },
    version: country.version,
    updatedAt: country.updatedAt?.toISOString() ?? null,
  };
}

router.get("/auth/countries", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(countriesTable).orderBy(asc(countriesTable.countryName));
    res.setHeader("Cache-Control", "no-store");
    res.json(CountryCatalog.parse({ countries: rows.map(toCountry) }));
  } catch (error) {
    req.log.error({ err: error }, "Public country catalog lookup failed");
    res.status(503).json({ error: "Country catalog unavailable" });
  }
});

adminRoutes.get("/countries", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  try {
    const rows = await db.select().from(countriesTable).orderBy(asc(countriesTable.countryName));
    await recordAdminAudit({
      adminUserId,
      action: "view_countries",
      resourceType: "country",
      resourceId: "catalog",
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminCountriesResponse.parse({ countries: rows.map(toCountry) }));
  } catch (error) {
    req.log.error({ err: error }, "Admin country catalog lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

adminRoutes.post("/countries", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = CreateAdminCountryBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid country data or audit reason" });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [country] = await tx
        .insert(countriesTable)
        .values({
          countryCode: body.data.countryCode,
          countryName: body.data.countryName.trim(),
          phonePrefix: body.data.phonePrefix,
          minPhoneDigits: body.data.minPhoneDigits,
          maxPhoneDigits: body.data.maxPhoneDigits,
          enabled: body.data.enabled,
          depositEnabled: false,
          interNetworkEnabled: false,
          internationalEnabled: false,
          version: 1,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })
        .onConflictDoNothing()
        .returning();
      if (!country) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "create_country",
        resourceType: "country",
        resourceId: country.countryCode,
        reason: body.data.reason.trim(),
      }, tx);
      return country;
    });

    if (!created) {
      res.status(409).json({ error: "Country code already exists" });
      return;
    }

    res.status(201).json(CreateAdminCountryResponse.parse(toCountry(created)));
  } catch (error) {
    req.log.error({ err: error }, "Admin country creation failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

adminRoutes.patch("/countries/:countryCode", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const params = UpdateAdminCountryParams.safeParse(req.params);
  const body = UpdateAdminCountryBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid country data or audit reason" });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [country] = await tx
        .update(countriesTable)
        .set({
          countryName: body.data.countryName.trim(),
          phonePrefix: body.data.phonePrefix,
          minPhoneDigits: body.data.minPhoneDigits,
          maxPhoneDigits: body.data.maxPhoneDigits,
          enabled: body.data.enabled,
          depositEnabled: body.data.operations.deposit,
          interNetworkEnabled: body.data.operations.interNetwork,
          internationalEnabled: body.data.operations.international,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(countriesTable.countryCode, params.data.countryCode),
          eq(countriesTable.version, body.data.expectedVersion),
        ))
        .returning();
      if (!country) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "update_country",
        resourceType: "country",
        resourceId: country.countryCode,
        reason: body.data.reason.trim(),
      }, tx);
      return country;
    });

    if (!updated) {
      res.status(409).json({ error: "Country changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminCountryResponse.parse(toCountry(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin country update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;
export { adminRoutes };
