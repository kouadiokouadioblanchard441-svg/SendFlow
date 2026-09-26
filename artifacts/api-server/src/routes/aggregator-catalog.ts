export const aggregatorCountryCatalog = [
  {
    countryCode: "ci",
    countryName: "Côte d’Ivoire",
    phonePrefix: "+225",
    operators: [
      { operatorId: "orange-ci", operatorName: "Orange Money" },
      { operatorId: "wave-ci", operatorName: "Wave" },
      { operatorId: "mtn-ci", operatorName: "MTN Mobile Money" },
      { operatorId: "moov-ci", operatorName: "Moov Money" },
    ],
  },
  {
    countryCode: "sn",
    countryName: "Sénégal",
    phonePrefix: "+221",
    operators: [
      { operatorId: "orange-sn", operatorName: "Orange Money" },
      { operatorId: "wave-sn", operatorName: "Wave" },
      { operatorId: "free-sn", operatorName: "Free Money" },
    ],
  },
  {
    countryCode: "bf",
    countryName: "Burkina Faso",
    phonePrefix: "+226",
    operators: [
      { operatorId: "orange-bf", operatorName: "Orange Money" },
      { operatorId: "moov-bf", operatorName: "Moov Money" },
      { operatorId: "telecel-bf", operatorName: "Telecel Money" },
    ],
  },
  {
    countryCode: "bj",
    countryName: "Bénin",
    phonePrefix: "+229",
    operators: [
      { operatorId: "mtn-bj", operatorName: "MTN Mobile Money" },
      { operatorId: "moov-bj", operatorName: "Moov Money" },
    ],
  },
  {
    countryCode: "ml",
    countryName: "Mali",
    phonePrefix: "+223",
    operators: [
      { operatorId: "orange-ml", operatorName: "Orange Money" },
      { operatorId: "moov-ml", operatorName: "Moov Money" },
    ],
  },
  {
    countryCode: "ne",
    countryName: "Niger",
    phonePrefix: "+227",
    operators: [
      { operatorId: "airtel-ne", operatorName: "Airtel Money" },
      { operatorId: "moov-ne", operatorName: "Moov Money" },
    ],
  },
  {
    countryCode: "tg",
    countryName: "Togo",
    phonePrefix: "+228",
    operators: [
      { operatorId: "tmoney-tg", operatorName: "TMoney" },
      { operatorId: "flooz-tg", operatorName: "Flooz" },
    ],
  },
  {
    countryCode: "cm",
    countryName: "Cameroun",
    phonePrefix: "+237",
    operators: [
      { operatorId: "orange-cm", operatorName: "Orange Money" },
      { operatorId: "mtn-cm", operatorName: "MTN Mobile Money" },
    ],
  },
  {
    countryCode: "cg",
    countryName: "Congo-Brazzaville",
    phonePrefix: "+242",
    operators: [
      { operatorId: "airtel-cg", operatorName: "Airtel Money" },
      { operatorId: "mtn-cg", operatorName: "MTN Mobile Money" },
    ],
  },
] as const;

export const builtInAggregatorCatalog = [
  { code: "paydunya", name: "PayDunya" },
] as const;

export type AggregatorCountry = (typeof aggregatorCountryCatalog)[number];
export type AggregatorOperator = AggregatorCountry["operators"][number];

export function findAggregatorCountry(countryCode: string): AggregatorCountry | undefined {
  return aggregatorCountryCatalog.find((country) => country.countryCode === countryCode);
}

export function findAggregatorOperator(countryCode: string, operatorId: string): AggregatorOperator | undefined {
  return findAggregatorCountry(countryCode)?.operators.find((operator) => operator.operatorId === operatorId);
}

export function getAggregatorRouteScopeKey(
  scopeType: "country" | "operator",
  countryCode: string,
  operatorId: string | null,
): string {
  return scopeType === "country" ? countryCode : `${countryCode}:${operatorId}`;
}