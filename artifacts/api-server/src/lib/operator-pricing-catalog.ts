import {
  asc,
  db,
  countriesTable,
} from "@workspace/db";

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

export function flagFromCountryCode(countryCode: string): string {
  if (!/^[a-z]{2}$/.test(countryCode)) return "";
  return String.fromCodePoint(
    ...[...countryCode.toUpperCase()].map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

export async function getPricingCountryCatalog() {
  const countries = await db.select().from(countriesTable).orderBy(asc(countriesTable.countryName));
  return countries.map((country) => ({
    id: country.countryCode,
    countryCode: country.countryCode,
    name: country.countryName,
    countryName: country.countryName,
    dialCode: country.phonePrefix,
    phonePrefix: country.phonePrefix,
    minPhoneDigits: country.minPhoneDigits,
    maxPhoneDigits: country.maxPhoneDigits,
    enabled: country.enabled,
    operations: {
      deposit: country.depositEnabled,
      interNetwork: country.interNetworkEnabled,
      international: country.internationalEnabled,
    },
    initials: country.countryCode.toUpperCase(),
    flag: flagFromCountryCode(country.countryCode),
  }));
}

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