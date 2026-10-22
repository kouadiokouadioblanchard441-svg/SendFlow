export const builtInAggregatorCatalog = [
  { code: "feexpay", name: "FeexPay" },
  { code: "paydunya", name: "PayDunya" },
] as const;

export function getAggregatorRouteScopeKey(
  scopeType: "country" | "operator",
  countryCode: string,
  operatorId: string | null,
): string {
  return scopeType === "country" ? countryCode : `${countryCode}:${operatorId}`;
}
