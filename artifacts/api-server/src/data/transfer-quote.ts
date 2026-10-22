import { db, eq, operatorCatalogTable, operatorPricingRatesTable } from "@workspace/db";
import { getAccountLimitSnapshot } from "../lib/account-limit";
import { pricingCountryCatalog } from "../lib/operator-pricing-catalog";
import type { QuoteDependencies } from "../services/transfer-quote";

export async function loadTransferQuoteDependencies(): Promise<QuoteDependencies> {
  const [operators, rates] = await Promise.all([
    db.select().from(operatorCatalogTable).where(eq(operatorCatalogTable.enabled, true)),
    db.select().from(operatorPricingRatesTable),
  ]);
  return {
    operators, rates, countries: pricingCountryCatalog,
    remainingMonthlyAmount: async (userId) => (await getAccountLimitSnapshot(userId)).remainingAmount,
  };
}
