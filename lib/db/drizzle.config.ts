import { defineConfig } from "drizzle-kit";

const databaseTarget = process.env.DRIZZLE_DATABASE_TARGET;
if (databaseTarget && databaseTarget !== "neon-production") {
  throw new Error(`Unsupported DRIZZLE_DATABASE_TARGET: ${databaseTarget}`);
}

const databaseUrl =
  databaseTarget === "neon-production"
    ? process.env.NEON_DATABASE_URL_PRODUCTION
    : process.env.DATABASE_URL;

if (databaseTarget === "neon-production" && !databaseUrl) {
  throw new Error(
    "NEON_DATABASE_URL_PRODUCTION is required for the neon-production schema target.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "",
  },
});