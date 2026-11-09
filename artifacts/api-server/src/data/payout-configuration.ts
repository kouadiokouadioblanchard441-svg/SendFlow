import {
  and,
  countriesTable,
  db,
  eq,
  operatorCatalogTable,
  operatorPricingRatesTable,
  paymentAggregatorRoutesTable,
  paymentAggregatorsTable,
  paymentLimitsTable,
} from "@workspace/db";
import { getAggregatorRouteScopeKey } from "../routes/aggregator-catalog";
import { feexpayChannelForOperator } from "../providers/feexpay/catalog";

export async function loadPayoutQuoteConfiguration(countryCode: string, operatorId: string) {
  const normalizedCountry = countryCode.toLowerCase();
  const [country] = await db.select().from(countriesTable)
    .where(eq(countriesTable.countryCode, normalizedCountry)).limit(1);
  const [operator] = await db.select().from(operatorCatalogTable)
    .where(and(
      eq(operatorCatalogTable.operatorId, operatorId),
      eq(operatorCatalogTable.countryCode, normalizedCountry),
    )).limit(1);
  const [rate] = await db.select().from(operatorPricingRatesTable)
    .where(and(
      eq(operatorPricingRatesTable.operatorId, operatorId),
      eq(operatorPricingRatesTable.countryCode, normalizedCountry),
      eq(operatorPricingRatesTable.categoryId, "payout"),
    )).limit(1);
  const [limits] = await db.select().from(paymentLimitsTable)
    .where(eq(paymentLimitsTable.id, "global")).limit(1);
  const routes = await db.select().from(paymentAggregatorRoutesTable)
    .where(and(
      eq(paymentAggregatorRoutesTable.countryCode, normalizedCountry),
      eq(paymentAggregatorRoutesTable.operation, "payout"),
    ));
  const countryRoute = routes.find((route) =>
    route.scopeType === "country" && route.scopeKey === normalizedCountry,
  );
  const operatorScopeKey = getAggregatorRouteScopeKey("operator", normalizedCountry, operatorId);
  const operatorRoute = routes.find((route) =>
    route.scopeType === "operator" && route.scopeKey === operatorScopeKey,
  );
  const routedAggregatorCode = operatorRoute?.aggregatorCode ?? countryRoute?.aggregatorCode ?? null;
  const [aggregator] = routedAggregatorCode
    ? await db.select({ enabled: paymentAggregatorsTable.enabled })
      .from(paymentAggregatorsTable).where(eq(paymentAggregatorsTable.code, routedAggregatorCode)).limit(1)
    : [];

  return {
    country: country ? {
      countryCode: country.countryCode,
      phonePrefix: country.phonePrefix,
      minPhoneDigits: country.minPhoneDigits,
      maxPhoneDigits: country.maxPhoneDigits,
      enabled: country.enabled,
      payoutEnabled: country.payoutEnabled,
    } : null,
    operator: operator ? {
      operatorId: operator.operatorId,
      countryCode: operator.countryCode,
      enabled: operator.enabled,
      payoutEnabled: operator.payoutEnabled,
    } : null,
    feePercent: rate?.feePercent ?? null,
    pricingVersion: rate?.version ?? null,
    minimumPayoutMinor: limits?.minimumPayoutMinor ?? 200,
    maximumTransferMinor: limits?.maximumTransferMinor ?? 0,
    maximumPayoutDailyMinor: limits?.maximumPayoutDailyMinor ?? null,
    executionRouteEnabled: routedAggregatorCode === "feexpay"
      && Boolean(aggregator?.enabled)
      && Boolean(feexpayChannelForOperator(normalizedCountry, operatorId)),
    routedAggregatorCode,
  };
}
