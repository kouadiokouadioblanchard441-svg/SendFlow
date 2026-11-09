import { resolveReplitLiveDatabaseUrl } from "@workspace/db/connection-config";

type Environment = Readonly<Record<string, string | undefined>>;

/** Environment authorization only; never sends requests or claims payment readiness. */
export function isFeexpayLiveExecutionAllowed(environment: Environment): boolean {
  const host = environment.FEEXPAY_EXECUTION_HOST;
  if (host === "replit") {
    if (
      environment.FEEXPAY_LIVE_ENABLED !== "true" ||
      environment.SENDFLOW_DATABASE_TARGET !== "shared-external"
    ) return false;
    try {
      resolveReplitLiveDatabaseUrl(environment);
      return true;
    } catch {
      return false;
    }
  }
  // Plesk is identified by its production runtime and explicit DB target.
  // Provider-specific host/live switches are unnecessary there, but unknown
  // host values and any Replit runtime identity still fail closed.
  if (host !== undefined && host !== "plesk") return false;
  return environment.NODE_ENV === "production" &&
    environment.SENDFLOW_DATABASE_TARGET === "production" &&
    !environment.REPL_ID && !environment.REPLIT_DEV_DOMAIN;
}
