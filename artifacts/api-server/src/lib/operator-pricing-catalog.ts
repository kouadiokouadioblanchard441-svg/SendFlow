import {
  db,
  operatorCatalogTable,
  operatorPricingRatesTable,
} from "@workspace/db";
import { aggregatorCountryCatalog } from "../routes/aggregator-catalog";

export const pricingCategories = [
  {
    id: "deposit",
    label: "Dépôt",
    shortLabel: "Dépôt",
    description: "Alimenter votre wallet SendFlow",
  },
  {
    id: "inter-network",
    label: "Transfert inter réseau",
    shortLabel: "Inter réseau",
    description: "Transférer entre deux réseaux",
  },
  {
    id: "international",
    label: "Transfert international",
    shortLabel: "International",
    description: "Envoyer vers un autre pays",
  },
] as const;

export type PricingCategoryId = (typeof pricingCategories)[number]["id"];
export type OperatorBrand = "orange" | "wave" | "mtn" | "moov" | "generic";

const countryFlags: Record<string, string> = {
  ci: "🇨🇮",
  sn: "🇸🇳",
  bf: "🇧🇫",
  bj: "🇧🇯",
  ml: "🇲🇱",
  ne: "🇳🇪",
  tg: "🇹🇬",
  cm: "🇨🇲",
  cg: "🇨🇬",
};

export const pricingCountryCatalog = aggregatorCountryCatalog.map((country) => ({
  id: country.countryCode,
  countryCode: country.countryCode,
  name: country.countryName,
  countryName: country.countryName,
  dialCode: country.phonePrefix,
  phonePrefix: country.phonePrefix,
  initials: country.countryCode.toUpperCase(),
  flag: countryFlags[country.countryCode] ?? "",
}));

function brandForOperator(operatorId: string): OperatorBrand {
  if (operatorId.startsWith("orange-")) return "orange";
  if (operatorId.startsWith("wave-")) return "wave";
  if (operatorId.startsWith("mtn-")) return "mtn";
  if (operatorId.startsWith("moov-")) return "moov";
  return "generic";
}

function shortNameForOperator(name: string): string {
  if (name.startsWith("MTN ")) return "MTN";
  return name.split(/\s+/)[0]?.slice(0, 30) || name.slice(0, 30);
}

function initialsForOperator(brand: OperatorBrand, shortName: string): string {
  if (brand === "orange") return "O";
  if (brand === "wave") return "W";
  if (brand === "mtn") return "MTN";
  if (brand === "moov") return "M";
  return shortName.slice(0, 3).toUpperCase();
}

const initialOperators = aggregatorCountryCatalog.flatMap((country) =>
  country.operators.map((operator) => {
    const brand = brandForOperator(operator.operatorId);
    const shortName = shortNameForOperator(operator.operatorName);
    return {
      operatorId: operator.operatorId,
      countryCode: country.countryCode,
      name: operator.operatorName,
      shortName,
      initials: initialsForOperator(brand, shortName),
      brand,
      enabled: true,
      version: 1,
      createdBy: "system:operator-catalog",
      updatedBy: "system:operator-catalog",
    };
  }),
);

const initialRates = initialOperators.flatMap((operator) =>
  pricingCategories.map((category) => ({
    operatorId: operator.operatorId,
    countryCode: operator.countryCode,
    categoryId: category.id,
    feePercent: 3,
    version: 1,
    createdBy: "system:operator-catalog",
    updatedBy: "system:operator-catalog",
  })),
);

let seedPromise: Promise<void> | undefined;

export async function ensureOperatorPricingSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [existingOperator] = await db
        .select({ operatorId: operatorCatalogTable.operatorId })
        .from(operatorCatalogTable)
        .limit(1);
      if (existingOperator) return;

      // This is a one-time bootstrap only; future catalog additions must be entered by an administrator.
      await db.transaction(async (tx) => {
        await tx
          .insert(operatorCatalogTable)
          .values(initialOperators)
          .onConflictDoNothing();
        await tx
          .insert(operatorPricingRatesTable)
          .values(initialRates)
          .onConflictDoNothing();
      });
    })();
  }

  try {
    await seedPromise;
  } catch (error) {
    seedPromise = undefined;
    throw error;
  }
}

export function createOperatorDisplayFields(name: string, brand: OperatorBrand) {
  const shortName = shortNameForOperator(name);
  return {
    shortName,
    initials: initialsForOperator(brand, shortName),
  };
}

export function isPricingCategoryId(value: string): value is PricingCategoryId {
  return pricingCategories.some((category) => category.id === value);
}