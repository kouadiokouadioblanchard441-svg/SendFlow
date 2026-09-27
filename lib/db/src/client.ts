import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const isProduction = process.env.NODE_ENV === "production";
const connectionString = isProduction
  ? process.env.NEON_DATABASE_URL_PRODUCTION
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    isProduction
      ? "NEON_DATABASE_URL_PRODUCTION is required to initialize the production database client."
      : "DATABASE_URL is required to initialize the development database client.",
  );
}

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);