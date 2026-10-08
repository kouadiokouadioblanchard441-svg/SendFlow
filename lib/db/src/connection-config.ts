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
    "SENDFLOW_DATABASE_TARGET must explicitly be 'development', 'shared-neon', or 'production'.",
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

  if (target === "neon-production") {
    requirePleskProduction(environment, "DRIZZLE_DATABASE_TARGET=neon-production");
    return requireDatabaseUrl(
      environment,
      "NEON_DATABASE_URL_PRODUCTION",
      "Plesk production",
    );
  }

  throw new Error(
    "DRIZZLE_DATABASE_TARGET must explicitly be 'replit-development' or 'neon-production'.",
  );
}
