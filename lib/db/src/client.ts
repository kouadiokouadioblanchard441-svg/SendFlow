import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.NEON_DATABASE_URL_PRODUCTION;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL_PRODUCTION is required to initialize the SendFlow database client.",
  );
}

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);