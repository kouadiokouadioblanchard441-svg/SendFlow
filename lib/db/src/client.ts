import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveRuntimeDatabaseUrl } from "./connection-config.ts";

const connectionString = resolveRuntimeDatabaseUrl(process.env);
const isSharedExternalDatabase =
  process.env.SENDFLOW_DATABASE_TARGET === "shared-external";

function getSharedDatabaseConnectionOptions() {
  if (!isSharedExternalDatabase) {
    return { connectionString };
  }

  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (!ca) {
    throw new Error("DATABASE_CA_CERT is required for the shared external database.");
  }

  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("The shared external database requires verified TLS.");
  }

  // pg's connection-string SSL parser can replace explicit CA options. The
  // URL has already been validated above; use Node TLS with the supplied CA.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");

  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname },
  };
}

export const pool = new Pool({
  ...getSharedDatabaseConnectionOptions(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);