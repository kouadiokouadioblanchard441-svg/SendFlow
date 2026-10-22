import { db, countriesTable, eq, operatorCatalogTable, operatorPricingRatesTable } from "@workspace/db";
import { getAccountLimitSnapshot } from "../lib/account-limit";
import type { QuoteDependencies } from "../services/transfer-quote";

export async function loadTransferQuoteDependencies(): Promise<QuoteDependencies> {
  const [operators, rates, countries] = await Promise.all([
    db.select().from(operatorCatalogTable).where(eq(operatorCatalogTable.enabled, true)),
    db.select().from(operatorPricingRatesTable),
    db.select().from(countriesTable),
  ]);
  return {
    operators,
    rates,
    countries: countries.map((country) => ({
      countryCode: country.countryCode,
      phonePrefix: country.phonePrefix,
      enabled: country.enabled,
      depositEnabled: country.depositEnabled,
      interNetworkEnabled: country.interNetworkEnabled,
      internationalEnabled: country.internationalEnabled,
      minPhoneDigits: country.minPhoneDigits,
      maxPhoneDigits: country.maxPhoneDigits,
    })),
    remainingMonthlyAmount: async (userId) => (await getAccountLimitSnapshot(userId)).remainingAmount,
  };
}
