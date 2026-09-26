import { Router, type IRouter } from "express";
import {
  and,
  db,
  eq,
  operatorCatalogTable,
  paymentAggregatorRoutesTable,
  paymentAggregatorsTable,
} from "@workspace/db";
import {
  CreateAdminAggregatorBody,
  CreateAdminAggregatorResponse,
  GetAdminPaymentRoutingResponse,
  UpdateAdminAggregatorBody,
  UpdateAdminAggregatorResponse,
  UpdateAdminAggregatorRouteBody,
  UpdateAdminAggregatorRouteResponse,
} from "@workspace/api-zod";
import { recordAdminAudit } from "../lib/admin-audit";
import { ensureOperatorPricingSeeded } from "../lib/operator-pricing-catalog";
import { respondAdminAuthError } from "./admin";
import {
  aggregatorCountryCatalog,
  builtInAggregatorCatalog,
  findAggregatorCountry,
  getAggregatorRouteScopeKey,
} from "./aggregator-catalog";

const router: IRouter = Router();

function toAdminAggregator(
  code: string,
  defaultName: string,
  stored?: typeof paymentAggregatorsTable.$inferSelect,
) {
  return {
    code,
    name: stored?.name ?? defaultName,
    enabled: stored?.enabled ?? false,
    adapterStatus: "not_implemented" as const,
    version: stored?.version ?? 0,
    updatedAt: stored?.updatedAt?.toISOString() ?? null,
  };
}

async function listAdminAggregators() {
  const rows = await db.select().from(paymentAggregatorsTable);
  const storedByCode = new Map(rows.map((row) => [row.code, row]));
  const builtInCodes = new Set(builtInAggregatorCatalog.map((aggregator) => aggregator.code));
  const items = [
    ...builtInAggregatorCatalog.map((aggregator) =>
      toAdminAggregator(aggregator.code, aggregator.name, storedByCode.get(aggregator.code)),
    ),
    ...rows
      .filter((row) => !builtInCodes.has(row.code as (typeof builtInAggregatorCatalog)[number]["code"]))
      .map((row) => toAdminAggregator(row.code, row.name, row)),
  ];

  return items.sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

async function findAggregator(code: string) {
  const builtIn = builtInAggregatorCatalog.find((aggregator) => aggregator.code === code);
  if (builtIn) return builtIn;

  const [stored] = await db
    .select({ code: paymentAggregatorsTable.code, name: paymentAggregatorsTable.name })
    .from(paymentAggregatorsTable)
    .where(eq(paymentAggregatorsTable.code, code))
    .limit(1);
  return stored;
}

router.get("/admin/payment-routing", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res);
  if (!adminUserId) return;

  try {
    await ensureOperatorPricingSeeded();
    const [aggregators, storedRoutes] = await Promise.all([
      listAdminAggregators(),
      db.select().from(paymentAggregatorRoutesTable),
    ]);
    const operatorRows = await db.select().from(operatorCatalogTable);
    const routesByScope = new Map(
      storedRoutes.map((route) => [`${route.scopeType}:${route.scopeKey}`, route]),
    );
    const countries = aggregatorCountryCatalog.map((country) => {
      const countryRoute = routesByScope.get(`country:${country.countryCode}`);
      const defaultAggregatorCode = countryRoute?.aggregatorCode ?? null;

      return {
        countryCode: country.countryCode,
        countryName: country.countryName,
        phonePrefix: country.phonePrefix,
        defaultAggregatorCode,
        defaultVersion: countryRoute?.version ?? 0,
        defaultUpdatedAt: countryRoute?.updatedAt?.toISOString() ?? null,
        operators: operatorRows
          .filter((operator) => operator.countryCode === country.countryCode)
          .sort((left, right) => left.name.localeCompare(right.name, "fr"))
          .map((operator) => {
          const operatorScopeKey = getAggregatorRouteScopeKey(
            "operator",
            country.countryCode,
            operator.operatorId,
          );
          const operatorRoute = routesByScope.get(`operator:${operatorScopeKey}`);
          const aggregatorCode = operatorRoute?.aggregatorCode ?? null;

          return {
            operatorId: operator.operatorId,
            operatorName: operator.name,
            operatorEnabled: operator.enabled,
            aggregatorCode,
            effectiveAggregatorCode: aggregatorCode ?? defaultAggregatorCode,
            inheritsCountryDefault: aggregatorCode === null,
            version: operatorRoute?.version ?? 0,
            updatedAt: operatorRoute?.updatedAt?.toISOString() ?? null,
          };
          }),
      };
    });

    await recordAdminAudit({
      adminUserId,
      action: "view_payment_routing",
      resourceType: "payment_aggregator",
      resourceId: "routing-configuration",
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(GetAdminPaymentRoutingResponse.parse({ aggregators, countries }));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment routing lookup failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.post("/admin/payment-aggregators", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = CreateAdminAggregatorBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid aggregator data or audit reason" });
    return;
  }

  if (builtInAggregatorCatalog.some((aggregator) => aggregator.code === body.data.code)) {
    res.status(409).json({ error: "This aggregator already exists in the provider catalog" });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [aggregator] = await tx
        .insert(paymentAggregatorsTable)
        .values({
          code: body.data.code,
          name: body.data.name.trim(),
          enabled: false,
          version: 1,
          createdBy: adminUserId,
          updatedBy: adminUserId,
        })
        .onConflictDoNothing()
        .returning();

      if (!aggregator) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "create_payment_aggregator",
        resourceType: "payment_aggregator",
        resourceId: aggregator.code,
        reason: body.data.reason.trim(),
      }, tx);

      return aggregator;
    });

    if (!created) {
      res.status(409).json({ error: "An aggregator with this code already exists" });
      return;
    }

    res.status(201).json(CreateAdminAggregatorResponse.parse(
      toAdminAggregator(created.code, created.name, created),
    ));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment aggregator creation failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.patch("/admin/payment-aggregators", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = UpdateAdminAggregatorBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid aggregator data or audit reason" });
    return;
  }

  try {
    const knownAggregator = await findAggregator(body.data.code);
    if (!knownAggregator) {
      res.status(404).json({ error: "Aggregator not found" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      let [aggregator] = await tx
        .update(paymentAggregatorsTable)
        .set({
          name: body.data.name.trim(),
          enabled: body.data.enabled,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(paymentAggregatorsTable.code, body.data.code),
          eq(paymentAggregatorsTable.version, body.data.expectedVersion),
        ))
        .returning();

      if (!aggregator && body.data.expectedVersion === 0 && builtInAggregatorCatalog.some(
        (item) => item.code === body.data.code,
      )) {
        [aggregator] = await tx
          .insert(paymentAggregatorsTable)
          .values({
            code: body.data.code,
            name: body.data.name.trim(),
            enabled: body.data.enabled,
            version: 1,
            createdBy: adminUserId,
            updatedBy: adminUserId,
          })
          .onConflictDoNothing()
          .returning();
      }

      if (!aggregator) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "update_payment_aggregator",
        resourceType: "payment_aggregator",
        resourceId: aggregator.code,
        reason: body.data.reason.trim(),
      }, tx);

      return aggregator;
    });

    if (!updated) {
      res.status(409).json({ error: "Aggregator changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminAggregatorResponse.parse(
      toAdminAggregator(updated.code, updated.name, updated),
    ));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment aggregator update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

router.put("/admin/payment-aggregator-routes", async (req, res): Promise<void> => {
  const adminUserId = respondAdminAuthError(req, res, "mutate");
  if (!adminUserId) return;

  const body = UpdateAdminAggregatorRouteBody.safeParse(req.body);
  if (!body.success || body.data.reason.trim().length < 3) {
    res.status(400).json({ error: "Invalid route data or audit reason" });
    return;
  }

  const { scopeType, countryCode, operatorId, aggregatorCode } = body.data;
  if (!findAggregatorCountry(countryCode)) {
    res.status(404).json({ error: "Unsupported country" });
    return;
  }
  if (scopeType === "country" && operatorId !== null) {
    res.status(400).json({ error: "Country routes cannot include an operator" });
    return;
  }
  if (scopeType === "operator" && !operatorId) {
    res.status(404).json({ error: "Unsupported operator for this country" });
    return;
  }
  const scopeKey = getAggregatorRouteScopeKey(scopeType, countryCode, operatorId);

  try {
    await ensureOperatorPricingSeeded();
    if (scopeType === "operator" && operatorId) {
      const [operator] = await db
        .select({ operatorId: operatorCatalogTable.operatorId })
        .from(operatorCatalogTable)
        .where(and(
          eq(operatorCatalogTable.countryCode, countryCode),
          eq(operatorCatalogTable.operatorId, operatorId),
        ))
        .limit(1);
      if (!operator) {
        res.status(404).json({ error: "Unsupported operator for this country" });
        return;
      }
    }

    if (aggregatorCode && !(await findAggregator(aggregatorCode))) {
      res.status(404).json({ error: "Aggregator not found" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      let [route] = await tx
        .update(paymentAggregatorRoutesTable)
        .set({
          aggregatorCode,
          version: body.data.expectedVersion + 1,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(paymentAggregatorRoutesTable.scopeType, scopeType),
          eq(paymentAggregatorRoutesTable.scopeKey, scopeKey),
          eq(paymentAggregatorRoutesTable.version, body.data.expectedVersion),
        ))
        .returning();

      if (!route && body.data.expectedVersion === 0) {
        [route] = await tx
          .insert(paymentAggregatorRoutesTable)
          .values({
            scopeType,
            scopeKey,
            countryCode,
            operatorId,
            aggregatorCode,
            version: 1,
            createdBy: adminUserId,
            updatedBy: adminUserId,
          })
          .onConflictDoNothing()
          .returning();
      }

      if (!route) return undefined;

      await recordAdminAudit({
        adminUserId,
        action: "update_payment_route",
        resourceType: "payment_route",
        resourceId: `${scopeType}:${scopeKey}`,
        reason: body.data.reason.trim(),
      }, tx);

      return route;
    });

    if (!updated) {
      res.status(409).json({ error: "Payment route changed since it was loaded" });
      return;
    }

    res.json(UpdateAdminAggregatorRouteResponse.parse({
      scopeType: updated.scopeType,
      countryCode: updated.countryCode,
      operatorId: updated.operatorId,
      aggregatorCode: updated.aggregatorCode,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    }));
  } catch (error) {
    req.log.error({ err: error }, "Admin payment route update failed");
    res.status(503).json({ error: "Administrator storage unavailable" });
  }
});

export default router;