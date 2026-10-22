import { resolveReplitLiveDatabaseUrl } from "@workspace/db/connection-config";

type Environment = Readonly<Record<string, string | undefined>>;

/** Environment authorization only; never sends requests or claims payment readiness. */
export function isFeexpayLiveExecutionAllowed(environment: Environment): boolean {
  if (environment.FEEXPAY_LIVE_ENABLED !== "true") return false;
  if (environment.FEEXPAY_EXECUTION_HOST === "plesk") {
    return environment.NODE_ENV === "production" &&
      environment.SENDFLOW_DATABASE_TARGET === "production" &&
      !environment.REPL_ID && !environment.REPLIT_DEV_DOMAIN;
  }
  if (
    environment.FEEXPAY_EXECUTION_HOST !== "replit" ||
    environment.SENDFLOW_DATABASE_TARGET !== "shared-neon"
  ) return false;
  try {
    resolveReplitLiveDatabaseUrl(environment);
    return true;
  } catch {
    return false;
  }
}
