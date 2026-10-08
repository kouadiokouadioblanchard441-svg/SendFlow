import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveRuntimeDatabaseUrl } from "./connection-config";

const connectionString = resolveRuntimeDatabaseUrl(process.env);

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);