import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveDrizzleDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from "./connection-config.ts";

const developmentUrl = "postgresql://dev.invalid/sendflow";
const productionUrl = "postgresql://production.invalid/sendflow";

test("runtime development uses DATABASE_URL, not the production secret", () => {
  assert.equal(
    resolveRuntimeDatabaseUrl({
      NODE_ENV: "development",
      REPL_ID: "repl-test",
      SENDFLOW_DATABASE_TARGET: "development",
      DATABASE_URL: developmentUrl,
      NEON_DATABASE_URL_PRODUCTION: productionUrl,
    }),
    developmentUrl,
  );
});

test("runtime development fails closed when only the production URL exists", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        SENDFLOW_DATABASE_TARGET: "development",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /DATABASE_URL is required for the Replit development database/,
  );
});

test("runtime shared Neon uses the production URL for Replit previews and tests", () => {
  assert.equal(
    resolveRuntimeDatabaseUrl({
      NODE_ENV: "development",
      REPL_ID: "repl-test",
      SENDFLOW_DATABASE_TARGET: "shared-neon",
      DATABASE_URL: developmentUrl,
      NEON_DATABASE_URL_PRODUCTION: productionUrl,
    }),
    productionUrl,
  );
});

test("runtime shared Neon fails closed without Replit or outside development mode", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        SENDFLOW_DATABASE_TARGET: "shared-neon",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /can only be used inside Replit/,
  );

  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "production",
        REPL_ID: "repl-test",
        SENDFLOW_DATABASE_TARGET: "shared-neon",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /cannot be used when NODE_ENV=production/,
  );
});

test("runtime shared Neon requires its configured secret", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        REPL_ID: "repl-test",
        SENDFLOW_DATABASE_TARGET: "shared-neon",
        DATABASE_URL: developmentUrl,
      }),
    /NEON_DATABASE_URL_PRODUCTION is required/,
  );
});

test("runtime requires an explicit database target", () => {
  assert.throws(
    () => resolveRuntimeDatabaseUrl({ NODE_ENV: "development" }),
    /SENDFLOW_DATABASE_TARGET must explicitly be/,
  );
});

test("runtime production is rejected inside Replit", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "production",
        REPL_ID: "repl-test",
        SENDFLOW_DATABASE_TARGET: "production",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /cannot run inside Replit/,
  );
});

test("runtime production requires production mode and uses the Plesk URL", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        SENDFLOW_DATABASE_TARGET: "production",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /requires NODE_ENV=production/,
  );

  assert.equal(
    resolveRuntimeDatabaseUrl({
      NODE_ENV: "production",
      SENDFLOW_DATABASE_TARGET: "production",
      NEON_DATABASE_URL_PRODUCTION: productionUrl,
    }),
    productionUrl,
  );
});

test("Drizzle development pushes use only the Replit database", () => {
  assert.equal(
    resolveDrizzleDatabaseUrl({
      NODE_ENV: "development",
      REPL_ID: "repl-test",
      DRIZZLE_DATABASE_TARGET: "replit-development",
      DATABASE_URL: developmentUrl,
      NEON_DATABASE_URL_PRODUCTION: productionUrl,
    }),
    developmentUrl,
  );
});

test("Drizzle refuses production pushes from Replit", () => {
  assert.throws(
    () =>
      resolveDrizzleDatabaseUrl({
        NODE_ENV: "production",
        REPL_ID: "repl-test",
        DRIZZLE_DATABASE_TARGET: "neon-production",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /cannot run inside Replit/,
  );
});

test("Drizzle production target works only in the Plesk environment", () => {
  assert.equal(
    resolveDrizzleDatabaseUrl({
      NODE_ENV: "production",
      DRIZZLE_DATABASE_TARGET: "neon-production",
      NEON_DATABASE_URL_PRODUCTION: productionUrl,
    }),
    productionUrl,
  );

  assert.throws(
    () =>
      resolveDrizzleDatabaseUrl({
        NODE_ENV: "development",
        DRIZZLE_DATABASE_TARGET: "neon-production",
        NEON_DATABASE_URL_PRODUCTION: productionUrl,
      }),
    /requires NODE_ENV=production/,
  );
});

test("Drizzle requires an explicit target", () => {
  assert.throws(
    () => resolveDrizzleDatabaseUrl({ NODE_ENV: "development" }),
    /DRIZZLE_DATABASE_TARGET must explicitly be/,
  );
});
