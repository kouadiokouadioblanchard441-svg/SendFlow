import { Router, type IRouter } from "express";
import {
  and,
  asc,
  db,
  eq,
  sql,
  countriesTable,
  contactsTable,
  legacyPaymentAggregatorRoutesTable,
  loginEventsTable,
  operatorCatalogTable,
  operatorOtpPoliciesTable,
  operatorPricingRatesTable,
  paymentAggregatorRoutesTable,
  paymentAttemptsTable,
  usersTable,
} from "@workspace/db";
import {
  GetAuthCountriesResponse,
  CreateAdminCountryBody,
  CreateAdminCountryResponse,
  DeleteAdminCountryBody,
  DeleteAdminCountryParams,
  GetAdminCountriesResponse,
  UpdateAdminCountryBody,
  UpdateAdminCountryParams,
  UpdateAdminCountryResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { createOperatorDisplayFields, pricingCategories } from "../lib/operator-pricing-catalog";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();

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
    signupEnabled: country.signupEnabled,
    flag: flagFromCountryCode(country.countryCode),
    operations: {
      deposit: country.depositEnabled,
      interNetwork: country.interNetworkEnabled,
      international: country.internationalEnabled,
      payout: country.payoutEnabled,
    },
    version: country.version,
    updatedAt: country.updatedAt?.toISOString() ?? null,
  };
}

function createOperatorId(name: string, countryCode: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug ? `${slug}-${countryCode}` : "";
}

class CountryCatalogConflictError extends Error {}

router.get("/auth/countries", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(countriesTable).orderBy(asc(countriesTable.countryName));
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAuthCountriesResponse.parse({ countries: rows.map(toCountry) }));
  } catch (error) {
    req.log.error({ err: error }, "Public country catalog lookup failed");
    res.status(503).json({ error: "Country catalog unavailable" });
  }
});

router.get("/auth/registration-countries", async (req, res): Promise<void> => {
  try {
    const rows = await db.select()
      .from(countriesTable)
      .where(eq(countriesTable.signupEnabled, true))
      .orderBy(asc(countriesTable.countryName));
    res.setHeader("Cache-Control", "no-store");
    res.json(GetAuthCountriesResponse.parse({ countries: rows.map(toCountry) }));
  } catch (error) {
    req.log.error({ err: error }, "Signup country catalog lookup failed");
    res.status(503).json({ error: "Signup country catalog unavailable" });
  }
});

export function createAdminCountryRoutes(authorize = respondAdminAuthError): IRouter {
const adminRoutes: IRouter = Router();

adminRoutes.get("/countries", async (req, res): Promise<void> => {
  const adminUserId = authorize(req, res);
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
  const adminUserId = authorize(req, res, "mutate");
  if (!adminUserId) return;

  const body = CreateAdminCountryBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3
    || body.data.minPhoneDigits > body.data.maxPhoneDigits
    || body.data.maxPhoneDigits + body.data.phonePrefix.length - 1 > 15) {
    res.status(400).json({ error: "Invalid country data or audit reason" });
    return;
  }

  const initialOperators = body.data.initialOperators ?? [];
  const initialOperatorIds = initialOperators.map((operator) =>
    createOperatorId(operator.name.trim(), body.data.countryCode),
  );
  if (initialOperatorIds.some((operatorId) => !operatorId)
    || new Set(initialOperatorIds).size !== initialOperatorIds.length) {
    res.status(400).json({ error: "Operator names must be unique and contain letters or numbers" });
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
          payoutEnabled: false,
          version: 1,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })
        .onConflictDoNothing()
        .returning();
      if (!country) return undefined;

      for (let index = 0; index < initialOperators.length; index += 1) {
        const initialOperator = initialOperators[index];
        const operatorId = initialOperatorIds[index];
        const [operator] = await tx
          .insert(operatorCatalogTable)
          .values({
            operatorId,
            countryCode: country.countryCode,
            name: initialOperator.name.trim(),
            ...createOperatorDisplayFields(initialOperator.name.trim(), initialOperator.brand),
            brand: initialOperator.brand,
            enabled: false,
            depositEnabled: false,
            interNetworkEnabled: false,
            internationalEnabled: false,
            payoutEnabled: false,
            version: 1,
            createdBy: adminUserId,
            updatedBy: adminUserId,
          })
          .onConflictDoNothing()
          .returning();
        if (!operator) throw new CountryCatalogConflictError("Duplicate operator");

        await tx.insert(operatorPricingRatesTable).values(
          pricingCategories.map((category) => ({
            operatorId,
            countryCode: country.countryCode,
            categoryId: category.id,
            feePercent: null,
            version: 1,
            createdBy: adminUserId,
            updatedBy: adminUserId,
          })),
        );
        await recordAdminAudit({
          adminUserId,
          action: "create_operator",
          resourceType: "operator",
          resourceId: operatorId,
          reason: body.data.reason.trim(),
        }, tx);
      }

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
    if (error instanceof CountryCatalogConflictError) {
      res.status(409).json({ error: "An initial operator already exists in this country" });
      return;
    }
    req.log.error({ err: error }, "Admin country creation failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

adminRoutes.patch("/countries/:countryCode", async (req, res): Promise<void> => {
  const adminUserId = authorize(req, res, "mutate");
  if (!adminUserId) return;

  const params = UpdateAdminCountryParams.safeParse(req.params);
  const body = UpdateAdminCountryBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.reason.trim().length < 3
    || body.data.minPhoneDigits > body.data.maxPhoneDigits
    || body.data.maxPhoneDigits + body.data.phonePrefix.length - 1 > 15) {
    res.status(400).json({ error: "Invalid country data or audit reason" });
    return;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('sendflow:signup-country-availability'))`);
      const [current] = await tx
        .select()
        .from(countriesTable)
        .where(eq(countriesTable.countryCode, params.data.countryCode))
        .for("update")
        .limit(1);
      if (!current || current.version !== body.data.expectedVersion) {
        return { kind: "changed" as const };
      }

      if (current.signupEnabled && !body.data.signupEnabled) {
        const availableCountries = await tx.select({ countryCode: countriesTable.countryCode })
          .from(countriesTable)
          .where(eq(countriesTable.signupEnabled, true));
        if (availableCountries.length <= 1) {
          return { kind: "last-signup-country" as const };
        }
      }

      const [country] = await tx
        .update(countriesTable)
        .set({
          countryName: body.data.countryName.trim(),
          phonePrefix: body.data.phonePrefix,
          minPhoneDigits: body.data.minPhoneDigits,
          maxPhoneDigits: body.data.maxPhoneDigits,
          enabled: body.data.enabled,
          signupEnabled: body.data.signupEnabled,
          depositEnabled: body.data.operations.deposit,
          interNetworkEnabled: body.data.operations.interNetwork,
          internationalEnabled: body.data.operations.international,
          payoutEnabled: body.data.operations.payout,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(countriesTable.countryCode, params.data.countryCode),
          eq(countriesTable.version, body.data.expectedVersion),
        ))
        .returning();
      if (!country) return { kind: "changed" as const };

      await recordAdminAudit({
        adminUserId,
        action: "update_country",
        resourceType: "country",
        resourceId: country.countryCode,
        reason: body.data.reason.trim(),
      }, tx);
      return { kind: "updated" as const, country };
    });

    if (updated.kind === "last-signup-country") {
      res.status(409).json({ error: "At least one country must remain available for signup." });
      return;
    }
    if (updated.kind !== "updated") {
      res.status(409).json({ error: "Country changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminCountryResponse.parse(toCountry(updated.country)));
  } catch (error) {
    req.log.error({ err: error }, "Admin country update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

adminRoutes.delete("/countries/:countryCode", async (req, res): Promise<void> => {
  const adminUserId = authorize(req, res, "mutate");
  if (!adminUserId) return;

  const params = DeleteAdminCountryParams.safeParse(req.params);
  const body = DeleteAdminCountryBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid country deletion request" });
    return;
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      const [country] = await tx
        .select()
        .from(countriesTable)
        .where(eq(countriesTable.countryCode, params.data.countryCode))
        .for("update")
        .limit(1);
      if (!country) return "missing" as const;
      if (country.version !== body.data.expectedVersion) return "changed" as const;
      if (
        country.signupEnabled ||
        country.enabled ||
        country.depositEnabled ||
        country.interNetworkEnabled ||
        country.internationalEnabled
        || country.payoutEnabled
      ) {
        return "referenced" as const;
      }

      const references = await Promise.all([
        tx.select({ countryCode: usersTable.countryCode }).from(usersTable)
          .where(eq(usersTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: contactsTable.countryCode }).from(contactsTable)
          .where(eq(contactsTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: loginEventsTable.countryCode }).from(loginEventsTable)
          .where(eq(loginEventsTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: paymentAttemptsTable.countryCode }).from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: operatorCatalogTable.countryCode }).from(operatorCatalogTable)
          .where(eq(operatorCatalogTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: paymentAggregatorRoutesTable.countryCode }).from(paymentAggregatorRoutesTable)
          .where(eq(paymentAggregatorRoutesTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: legacyPaymentAggregatorRoutesTable.countryCode }).from(legacyPaymentAggregatorRoutesTable)
          .where(eq(legacyPaymentAggregatorRoutesTable.countryCode, country.countryCode)).limit(1),
        tx.select({ countryCode: operatorOtpPoliciesTable.countryCode }).from(operatorOtpPoliciesTable)
          .where(eq(operatorOtpPoliciesTable.countryCode, country.countryCode)).limit(1),
      ]);
      if (references.some((rows) => rows.length > 0)) return "referenced" as const;

      const [removed] = await tx.delete(countriesTable)
        .where(and(
          eq(countriesTable.countryCode, country.countryCode),
          eq(countriesTable.version, body.data.expectedVersion),
        ))
        .returning({ countryCode: countriesTable.countryCode });
      if (!removed) return "changed" as const;

      await recordAdminAudit({
        adminUserId,
        action: "delete_country",
        resourceType: "country",
        resourceId: country.countryCode,
        reason: body.data.reason.trim(),
      }, tx);
      return "deleted" as const;
    });

    if (deleted === "missing") {
      res.status(404).json({ error: "Country not found" });
      return;
    }
    if (deleted === "changed") {
      res.status(409).json({ error: "Country changed since it was loaded" });
      return;
    }
    if (deleted === "referenced") {
      res.status(409).json({ error: "Country is active or referenced by existing data or configuration; disable it instead" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Admin country deletion failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

return adminRoutes;
}

const adminRoutes = createAdminCountryRoutes();
export default router;
export { adminRoutes };
