const DATABASE_FAILURE_CATEGORIES = {
  schema: new Set(["3F000", "42P01", "42703"]),
  access: new Set(["42501"]),
  authentication: new Set(["28000", "28P01"]),
  unavailable: new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "57P01",
    "57P02",
    "57P03",
  ]),
  tls: new Set([
    "CERT_HAS_EXPIRED",
    "CERT_NOT_YET_VALID",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_GET_ISSUER_CERT",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  ]),
} as const;

export type DatabaseFailureCategory =
  | "database_schema_mismatch"
  | "database_access_denied"
  | "database_authentication_failed"
  | "database_unavailable"
  | "database_tls_failure"
  | "database_query_failed";

function readDataProperty(value: object, key: string): unknown {
  try {
    return Object.getOwnPropertyDescriptor(value, key)?.value;
  } catch {
    return undefined;
  }
}

function hasCode(codes: ReadonlySet<string>, code: string): boolean {
  return codes.has(code);
}

export function classifyDatabaseFailure(
  error: unknown,
): DatabaseFailureCategory {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || (typeof current !== "object" && typeof current !== "function")) {
      break;
    }
    const code = readDataProperty(current, "code");
    if (typeof code === "string") {
      if (hasCode(DATABASE_FAILURE_CATEGORIES.tls, code)) {
        return "database_tls_failure";
      }
      if (hasCode(DATABASE_FAILURE_CATEGORIES.schema, code)) {
        return "database_schema_mismatch";
      }
      if (hasCode(DATABASE_FAILURE_CATEGORIES.access, code)) {
        return "database_access_denied";
      }
      if (hasCode(DATABASE_FAILURE_CATEGORIES.authentication, code)) {
        return "database_authentication_failed";
      }
      if (hasCode(DATABASE_FAILURE_CATEGORIES.unavailable, code)) {
        return "database_unavailable";
      }
    }
    current = readDataProperty(current, "cause");
  }
  return "database_query_failed";
}
