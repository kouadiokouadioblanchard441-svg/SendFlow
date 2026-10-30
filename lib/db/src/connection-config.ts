type Environment = Readonly<Record<string, string | undefined>>;

function requireDatabaseUrl(
  environment: Environment,
  variableName: string,
  target: string,
): string {
  const value = environment[variableName];
  if (!value?.trim()) {
    throw new Error(`${variableName} is required for the ${target} database.`);
  }
  return value;
}

function requirePleskProduction(environment: Environment, target: string): void {
  if (environment.NODE_ENV !== "production") {
    throw new Error(`${target} requires NODE_ENV=production.`);
  }
  if (environment.REPL_ID) {
    throw new Error(`${target} cannot run inside Replit.`);
  }
}

function requireVerifiedDatabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error("Invalid database connection.");
    }
  } catch {
    // Do not propagate URL parser errors: they can contain credentials.
    throw new Error("External database configuration is invalid.");
  }
  const sslMode = url.searchParams.get("sslmode");
  if (
    (sslMode !== null && !["require", "verify-ca", "verify-full"].includes(sslMode)) ||
    ["false", "0"].includes(url.searchParams.get("ssl") ?? "")
  ) {
    throw new Error("Replit live database requires verified TLS.");
  }
  // Enforce certificate and hostname verification, independently of pg defaults.
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

/**
 * Live payment testing against a shared external database requires explicit approval.
 * Authorization here never opens HTTP routes, grants account access, or moves funds.
 */
export function resolveReplitLiveDatabaseUrl(environment: Environment): string {
  if (
    !environment.REPL_ID ||
    !environment.REPLIT_DEV_DOMAIN ||
    environment.NODE_ENV !== "development" ||
    environment.SENDFLOW_DATABASE_TARGET !== "shared-external" ||
    environment.SENDFLOW_REPLIT_LIVE_APPROVED !== "true" ||
    environment.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  ) {
    throw new Error("Replit live requires explicit approval for the connected shared database.");
  }
  return requireVerifiedDatabaseUrl(requireDatabaseUrl(
    environment, "SUPABASE_DATABASE_URL", "Replit shared database",
  ));
}

export function resolveRuntimeDatabaseUrl(environment: Environment): string {
  const target = environment.SENDFLOW_DATABASE_TARGET;

  if (target === "development") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=development cannot be used when NODE_ENV=production.",
      );
    }
    return requireDatabaseUrl(environment, "DATABASE_URL", "Replit development");
  }

  if (target === "shared-external") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=shared-external cannot be used when NODE_ENV=production.",
      );
    }
    if (!environment.REPL_ID) {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=shared-external can only be used inside Replit.",
      );
    }
    const url = requireDatabaseUrl(
      environment,
      "SUPABASE_DATABASE_URL",
      "Replit shared database",
    );
    return requireVerifiedDatabaseUrl(url);
  }

  if (target === "production") {
    requirePleskProduction(environment, "SENDFLOW_DATABASE_TARGET=production");
    return requireDatabaseUrl(
      environment,
      "DATABASE_URL",
      "Plesk production",
    );
  }

  throw new Error(
    "SENDFLOW_DATABASE_TARGET must explicitly be 'development', 'shared-external', or 'production'.",
  );
}

export function resolveDrizzleDatabaseUrl(environment: Environment): string {
  const target = environment.DRIZZLE_DATABASE_TARGET;

  if (target === "replit-development") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "DRIZZLE_DATABASE_TARGET=replit-development cannot be used when NODE_ENV=production.",
      );
    }
    return requireDatabaseUrl(environment, "DATABASE_URL", "Replit development");
  }

  if (target === "production") {
    requirePleskProduction(environment, "DRIZZLE_DATABASE_TARGET=production");
    return requireDatabaseUrl(environment, "DATABASE_URL", "Plesk production");
  }

  throw new Error(
    "DRIZZLE_DATABASE_TARGET must explicitly be 'replit-development' or 'production'.",
  );
}
