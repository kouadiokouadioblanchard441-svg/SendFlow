import { createHash } from "node:crypto";
import { feexpayChannels, feexpayCountries, feexpayOperations, sendflowOperatorId } from "./catalog.ts";

type ConfigRow = Record<string, unknown>;
export interface FeexpayConfigurationSnapshot {
  countries: (ConfigRow & { country_code: string })[];
  operators: (ConfigRow & { operator_id: string; country_code: string })[];
  providers: (ConfigRow & { code: string })[];
  routes: (ConfigRow & {
    scope_type: string; scope_key: string; country_code: string;
    operation: string; operator_id: string | null; aggregator_code: string | null;
  })[];
}

export interface FeexpayOperatorSeed {
  operator_id: string;
  country_code: string;
  name: string;
  short_name: string;
  initials: string;
  brand: string;
}
export interface FeexpayRouteSeed {
  country_code: string;
  operator_id: string;
  operation: "deposit" | "inter-network" | "international";
}

const additionalOperators: readonly FeexpayOperatorSeed[] = [
  { operator_id: "celtiis-bj", country_code: "bj", name: "Celtiis Cash", short_name: "Celtiis", initials: "CE", brand: "generic" },
  { operator_id: "coris-bj", country_code: "bj", name: "Coris Money", short_name: "Coris", initials: "CO", brand: "generic" },
  { operator_id: "wave-bf", country_code: "bf", name: "Wave", short_name: "Wave", initials: "WA", brand: "wave" },
];

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export function planFeexpayConfiguration(snapshot: FeexpayConfigurationSnapshot) {
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical({
    policyVersion: 3, xafRegistrationOnly: true,
    snapshot, countries: feexpayCountries, operators: additionalOperators,
    channels: feexpayChannels.map((channel) => ({
      ...channel, sendflowOperatorId: sendflowOperatorId(channel), operations: feexpayOperations(channel),
    })),
  }))).digest("hex");
  const newOperators: FeexpayOperatorSeed[] = [];
  const newRoutes: FeexpayRouteSeed[] = [];
  const conflicts: string[] = [];
  const pendingCurrencyCountries: { countryCode: string; currency: string; reason: string }[] = [];
  const countries = new Set(snapshot.countries.map((row) => row.country_code));
  const operators = new Map(snapshot.operators.map((row) => [row.operator_id, row]));
  const routes = new Map(snapshot.routes.map((row) => [`${row.scope_type}:${row.scope_key}:${row.operation}`, row]));
  if (snapshot.providers.find((row) => row.code === "feexpay")?.enabled === true) {
    conflicts.push("PROVIDER_ALREADY_ENABLED_MANUAL_REVIEW");
  }
  for (const country of feexpayCountries) {
    const code = country.countryCode.toLowerCase();
    if (country.currency !== "XOF") pendingCurrencyCountries.push({
      countryCode: code,
      currency: country.currency,
      reason: "PROVIDER_ROUTE_ONLY_DISABLED_UNTIL_SENDFLOW_SUPPORTS_THIS_CURRENCY",
    });
    if (!countries.has(code)) {
      conflicts.push(`MISSING_COUNTRY:${code}`);
      continue;
    }
    for (const channel of feexpayChannels.filter((candidate) => candidate.countryCode === country.countryCode)) {
      const operatorId = sendflowOperatorId(channel);
      const existing = operators.get(operatorId);
      if (existing && existing.country_code !== code) {
        conflicts.push(`OPERATOR_COUNTRY_MISMATCH:${operatorId}`);
        continue;
      }
      if (!existing) {
        const seed = additionalOperators.find((candidate) => candidate.operator_id === operatorId);
        if (!seed) {
          conflicts.push(`MISSING_OPERATOR_REQUIRES_REVIEW:${operatorId}`);
          continue;
        }
        newOperators.push({ ...seed });
      }
      for (const operation of feexpayOperations(channel)) {
        const operationFlag = operation === "deposit"
          ? "deposit_enabled"
          : operation === "inter-network"
            ? "inter_network_enabled"
            : "international_enabled";
        const country = snapshot.countries.find((candidate) => candidate.country_code === code);
        if (country?.enabled === true && country[operationFlag] === true &&
            existing?.enabled === true && existing[operationFlag] === true) {
          conflicts.push(`ACTIVE_OPERATOR_OPERATION_REQUIRES_MANUAL_REVIEW:${operatorId}:${operation}`);
        }
        const own = routes.get(`operator:${code}:${operatorId}:${operation}`);
        if (own) {
          if (own.aggregator_code !== "feexpay") conflicts.push(`EXISTING_OPERATOR_CHOICE:${operatorId}:${operation}`);
          continue;
        }
        const inherited = routes.get(`country:${code}:${operation}`);
        if (inherited && inherited.aggregator_code !== "feexpay") {
          conflicts.push(`EXISTING_COUNTRY_CHOICE:${code}:${operation}`);
          continue;
        }
        newRoutes.push({ country_code: code, operator_id: operatorId, operation });
      }
    }
  }
  return {
    fingerprint,
    createProvider: !snapshot.providers.some((row) => row.code === "feexpay"),
    newOperators, newRoutes, pendingCurrencyCountries, conflicts,
  };
}
