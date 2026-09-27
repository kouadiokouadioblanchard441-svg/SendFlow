import { defineConfig } from "drizzle-kit";

const databaseTarget = process.env.DRIZZLE_DATABASE_TARGET;
if (databaseTarget !== "neon-production") {
  if (!databaseTarget) {
    throw new Error(
      "Set DRIZZLE_DATABASE_TARGET=neon-production to run schema operations against the SendFlow database.",
    );
  }
  throw new Error(`Unsupported DRIZZLE_DATABASE_TARGET: ${databaseTarget}`);
}

const databaseUrl = process.env.NEON_DATABASE_URL_PRODUCTION;

if (!databaseUrl) {
  throw new Error(
    "NEON_DATABASE_URL_PRODUCTION is required for the SendFlow schema target.",
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