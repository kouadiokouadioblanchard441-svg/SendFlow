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

/**
 * A real-payment workspace must not reuse the database served by Plesk.
 * This only validates configuration; it never opens a connection or migrates data.
 */
export function resolveReplitLiveDatabaseUrl(environment: Environment): string {
  if (
    !environment.REPL_ID ||
    !environment.REPLIT_DEV_DOMAIN ||
    environment.SENDFLOW_REPLIT_LIVE_APPROVED !== "true" ||
    !["development", "production"].includes(environment.NODE_ENV ?? "")
  ) {
    throw new Error("Replit live requires explicit approval and a Replit runtime.");
  }
  const previewValue = requireDatabaseUrl(environment, "NEON_DATABASE_URL_PREVIEW", "Replit live");
  const productionValue = requireDatabaseUrl(environment, "NEON_DATABASE_URL_PRODUCTION", "production isolation check");
  let preview: URL;
  let production: URL;
  const identity = (url: URL): string => {
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error("Invalid database connection.");
    }
    // Neon pooled and direct endpoints refer to the same database.
    const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/-pooler(?=\.)/, "");
    return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
  };
  let sameDatabase: boolean;
  try {
    preview = new URL(previewValue);
    production = new URL(productionValue);
    sameDatabase = identity(preview) === identity(production);
  } catch {
    // Do not propagate URL parser errors: they can contain credentials.
    throw new Error("Replit live database configuration is invalid.");
  }
  if (sameDatabase) {
    throw new Error("Replit live must use a database distinct from Plesk production.");
  }
  const sslMode = preview.searchParams.get("sslmode");
  if (
    (sslMode !== null && !["require", "verify-ca", "verify-full"].includes(sslMode)) ||
    ["false", "0"].includes(preview.searchParams.get("ssl") ?? "")
  ) {
    throw new Error("Replit live database requires verified TLS.");
  }
  // Enforce certificate and hostname verification, independently of pg defaults.
  preview.searchParams.delete("ssl");
  preview.searchParams.delete("uselibpqcompat");
  preview.searchParams.set("sslmode", "verify-full");
  return preview.toString();
}

export function resolveRuntimeDatabaseUrl(environment: Environment): string {
  const target = environment.SENDFLOW_DATABASE_TARGET;

  if (target === "replit-live") {
    return resolveReplitLiveDatabaseUrl(environment);
  }

  if (target === "development") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=development cannot be used when NODE_ENV=production.",
      );
    }
    return requireDatabaseUrl(environment, "DATABASE_URL", "Replit development");
  }

  if (target === "shared-neon") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=shared-neon cannot be used when NODE_ENV=production.",
      );
    }
    if (!environment.REPL_ID) {
      throw new Error(
        "SENDFLOW_DATABASE_TARGET=shared-neon can only be used inside Replit.",
      );
    }
    return requireDatabaseUrl(
      environment,
      "NEON_DATABASE_URL_PRODUCTION",
      "Replit shared Neon",
    );
  }

  if (target === "production") {
    requirePleskProduction(environment, "SENDFLOW_DATABASE_TARGET=production");
    return requireDatabaseUrl(
      environment,
      "NEON_DATABASE_URL_PRODUCTION",
      "Plesk production",
    );
  }

  throw new Error(
    "SENDFLOW_DATABASE_TARGET must explicitly be 'development', 'shared-neon', 'replit-live', or 'production'.",
  );
}

export function resolveDrizzleDatabaseUrl(environment: Environment): string {
  const target = environment.DRIZZLE_DATABASE_TARGET;

  if (target === "neon-replit-live") {
    return resolveReplitLiveDatabaseUrl(environment);
  }

  if (target === "replit-development") {
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "DRIZZLE_DATABASE_TARGET=replit-development cannot be used when NODE_ENV=production.",
      );
    }
    return requireDatabaseUrl(environment, "DATABASE_URL", "Replit development");
  }

  if (target === "neon-production") {
    requirePleskProduction(environment, "DRIZZLE_DATABASE_TARGET=neon-production");
    return requireDatabaseUrl(
      environment,
      "NEON_DATABASE_URL_PRODUCTION",
      "Plesk production",
    );
  }

  throw new Error(
    "DRIZZLE_DATABASE_TARGET must explicitly be 'replit-development', 'neon-replit-live', or 'neon-production'.",
  );
}
