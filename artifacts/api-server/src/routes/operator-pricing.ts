import { Router, type IRouter } from "express";
import {
  and,
  db,
  eq,
  inArray,
  operatorCatalogTable,
  operatorOtpPoliciesTable,
  operatorPricingRatesTable,
} from "@workspace/db";
import {
  CreateAdminOperatorBody,
  CreateAdminOperatorResponse,
  GetAdminOperatorPricingResponse,
  GetPublicPricingResponse,
  UpdateAdminOperatorBody,
  UpdateAdminOperatorPricingBody,
  UpdateAdminOperatorPricingResponse,
  UpdateAdminOperatorResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import {
  createOperatorDisplayFields,
  isPricingCategoryId,
  pricingCategories,
  pricingCountryCatalog,
  type PricingCategoryId,
} from "../lib/operator-pricing-catalog";
import { respondAdminAuthError } from "./admin";

const router: IRouter = Router();
const defaultOtpOperatorIds = new Set(["orange-ci", "orange-sn", "orange-bf", "orange-ml"]);
const otpCommands: Record<string, string> = {
  "orange-ci": "#144*82# option 2",
};

function toManagedOperator(
  operator: typeof operatorCatalogTable.$inferSelect,
  rates: Array<typeof operatorPricingRatesTable.$inferSelect> = [],
) {
  return {
    operatorId: operator.operatorId,
    countryCode: operator.countryCode,
    name: operator.name,
    shortName: operator.shortName,
    initials: operator.initials,
    brand: operator.brand,
    enabled: operator.enabled,
    version: operator.version,
    updatedAt: operator.updatedAt?.toISOString() ?? null,
    ...(rates.length > 0
      ? {
          rates: rates.map((rate) => ({
            categoryId: rate.categoryId,
            feePercent: rate.feePercent,
            version: rate.version,
            updatedAt: rate.updatedAt?.toISOString() ?? null,
          })),
        }
      : {}),
  };
}

router.get("/pricing", async (req, res): Promise<void> => {
  try {
    const [operators, rates, otpPolicies] = await Promise.all([
      db.select().from(operatorCatalogTable),
      db.select().from(operatorPricingRatesTable),
      db.select().from(operatorOtpPoliciesTable),
    ]);
    const rateRowsByOperator = new Map<string, typeof rates>();
    for (const rate of rates) {
      const operatorRates = rateRowsByOperator.get(rate.operatorId) ?? [];
      operatorRates.push(rate);
      rateRowsByOperator.set(rate.operatorId, operatorRates);
    }
    const otpByOperator = new Map(
      otpPolicies.map((policy) => [`${policy.countryCode}:${policy.operatorId}`, policy.requiresOtp]),
    );

    const publicOperators = operators
      .filter((operator) => operator.enabled)
      .sort((left, right) => {
        const countryOrder = left.countryCode.localeCompare(right.countryCode);
        return countryOrder || left.name.localeCompare(right.name, "fr");
      })
      .map((operator) => {
        const fees: Partial<Record<PricingCategoryId, number>> = {};
        for (const rate of rateRowsByOperator.get(operator.operatorId) ?? []) {
          if (isPricingCategoryId(rate.categoryId) && rate.feePercent !== null) {
            fees[rate.categoryId] = rate.feePercent / 100;
          }
        }

        return {
          id: operator.operatorId,
          countryId: operator.countryCode,
          name: operator.name,
          shortName: operator.shortName,
          initials: operator.initials,
          brand: operator.brand,
          requiresOtp:
            otpByOperator.get(`${operator.countryCode}:${operator.operatorId}`) ??
            defaultOtpOperatorIds.has(operator.operatorId),
          otpCommand: otpCommands[operator.operatorId] ?? null,
          fees,
        };
      });

    res.setHeader("Cache-Control", "no-store");
    res.json(
      GetPublicPricingResponse.parse({
        categories: pricingCategories,
        countries: pricingCountryCatalog.map(({ id, name, dialCode, initials, flag }) => ({
          id,
          name,
          dialCode,
          initials,
          flag,
        })),
        operators: publicOperators,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Public operator pricing lookup failed");
    res.status(503).json({ error: "Pricing catalog unavailable" });
  }
});

router.get("/admin/operator-pricing", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  try {
    const [operators, rates] = await Promise.all([
      db.select().from(operatorCatalogTable),
      db.select().from(operatorPricingRatesTable),
    ]);
    const rateRowsByOperator = new Map<string, typeof rates>();
    for (const rate of rates) {
      const operatorRates = rateRowsByOperator.get(rate.operatorId) ?? [];
      operatorRates.push(rate);
      rateRowsByOperator.set(rate.operatorId, operatorRates);
    }
    const countries = pricingCountryCatalog.map((country) => ({
      countryCode: country.countryCode,
      countryName: country.countryName,
      phonePrefix: country.phonePrefix,
      initials: country.initials,
      flag: country.flag,
      operators: operators
        .filter((operator) => operator.countryCode === country.countryCode)
        .sort((left, right) => left.name.localeCompare(right.name, "fr"))
        .map((operator) =>
          toManagedOperator(operator, rateRowsByOperator.get(operator.operatorId) ?? []),
        ),
    }));

    await recordAdminAudit({
      adminUserId,
      action: "view_operator_pricing",
      resourceType: "operator_pricing",
      resourceId: "catalog",
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminOperatorPricingResponse.parse({ categories: pricingCategories, countries }));
  } catch (error) {
    req.log.error({ err: error }, "Admin operator pricing lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.post("/admin/operators", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = CreateAdminOperatorBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid operator data or audit reason" });
    return;
  }

  const slug = body.data.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  if (slug.length < 1) {
    res.status(400).json({ error: "Operator name must include a letter or number" });
    return;
  }

  const operatorId = `${slug}-${body.data.countryCode}`;
  const display = createOperatorDisplayFields(body.data.name.trim(), body.data.brand);

  try {
    const created = await db.transaction(async (tx) => {
      const [operator] = await tx
        .insert(operatorCatalogTable)
        .values({
          operatorId,
          countryCode: body.data.countryCode,
          name: body.data.name.trim(),
          ...display,
          brand: body.data.brand,
          enabled: false,
          version: 1,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })
        .onConflictDoNothing()
        .returning();

      if (!operator) return undefined;

      await tx.insert(operatorPricingRatesTable).values(
        pricingCategories.map((category) => ({
          operatorId,
          countryCode: body.data.countryCode,
          categoryId: category.id,
          feePercent: null,
          version: 1,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })),
      );
      await recordAdminAudit(
        {
          adminUserId,
          action: "create_operator",
          resourceType: "operator",
          resourceId: operatorId,
          reason: body.data.reason.trim(),
        },
        tx,
      );
      return operator;
    });

    if (!created) {
      res.status(409).json({ error: "An operator with this name already exists in the country" });
      return;
    }

    res.status(201).json(
      CreateAdminOperatorResponse.parse(toManagedOperator(created)),
    );
  } catch (error) {
    req.log.error({ err: error }, "Admin operator creation failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.patch("/admin/operators/:operatorId", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = UpdateAdminOperatorBody.safeParse(req.body);
  const operatorId = typeof req.params.operatorId === "string" ? req.params.operatorId : "";
  if (!body.success || body.data.reason.trim().length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operatorId)) {
    res.status(400).json({ error: "Invalid operator data or audit reason" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(operatorCatalogTable)
      .where(eq(operatorCatalogTable.operatorId, operatorId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Operator not found" });
      return;
    }

    const display = createOperatorDisplayFields(body.data.name.trim(), body.data.brand);
    const updated = await db.transaction(async (tx) => {
      const [operator] = await tx
        .update(operatorCatalogTable)
        .set({
          name: body.data.name.trim(),
          ...display,
          brand: body.data.brand,
          enabled: body.data.enabled,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(operatorCatalogTable.operatorId, operatorId),
            eq(operatorCatalogTable.version, body.data.expectedVersion),
          ),
        )
        .returning();
      if (!operator) return undefined;

      await recordAdminAudit(
        {
          adminUserId,
          action: "update_operator",
          resourceType: "operator",
          resourceId: operator.operatorId,
          reason: body.data.reason.trim(),
        },
        tx,
      );
      return operator;
    });

    if (!updated) {
      res.status(409).json({ error: "Operator changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminOperatorResponse.parse(toManagedOperator(updated)));
  } catch (error) {
    req.log.error({ err: error }, "Admin operator update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

class PricingRateConflictError extends Error {}

router.put("/admin/operator-pricing-rates", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = UpdateAdminOperatorPricingBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid rates or audit reason" });
    return;
  }

  const { countryCode, categoryId, updates } = body.data;
  if (new Set(updates.map((update) => update.operatorId)).size !== updates.length) {
    res.status(400).json({ error: "Each operator can only appear once in a section update" });
    return;
  }

  try {
    const requestedIds = updates.map((update) => update.operatorId);
    const knownOperators = await db
      .select({ operatorId: operatorCatalogTable.operatorId, countryCode: operatorCatalogTable.countryCode })
      .from(operatorCatalogTable)
      .where(inArray(operatorCatalogTable.operatorId, requestedIds));
    if (
      knownOperators.length !== requestedIds.length ||
      knownOperators.some((operator) => operator.countryCode !== countryCode)
    ) {
      res.status(404).json({ error: "One or more operators are not part of this country" });
      return;
    }

    const updatedRates = await db.transaction(async (tx) => {
      const rows: Array<typeof operatorPricingRatesTable.$inferSelect> = [];
      for (const update of updates) {
        const [rate] = await tx
          .update(operatorPricingRatesTable)
          .set({
            feePercent: update.feePercent,
            version: update.expectedVersion + 1,
            updatedBy: adminUserId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(operatorPricingRatesTable.operatorId, update.operatorId),
              eq(operatorPricingRatesTable.countryCode, countryCode),
              eq(operatorPricingRatesTable.categoryId, categoryId),
              eq(operatorPricingRatesTable.version, update.expectedVersion),
            ),
          )
          .returning();
        if (!rate) throw new PricingRateConflictError();
        rows.push(rate);
      }

      await recordAdminAudit(
        {
          adminUserId,
          action: "update_operator_pricing",
          resourceType: "operator_pricing",
          resourceId: `${countryCode}:${categoryId}`,
          reason: body.data.reason.trim(),
        },
        tx,
      );
      return rows;
    });

    res.json(
      UpdateAdminOperatorPricingResponse.parse({
        items: updatedRates.map((rate) => ({
          operatorId: rate.operatorId,
          categoryId: rate.categoryId,
          feePercent: rate.feePercent,
          version: rate.version,
          updatedAt: rate.updatedAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    if (error instanceof PricingRateConflictError) {
      res.status(409).json({ error: "One or more rates changed since they were loaded" });
      return;
    }
    req.log.error({ err: error }, "Admin operator pricing update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;