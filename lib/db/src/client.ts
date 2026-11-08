import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "./connection-config.ts";

export const pool = new Pool({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);