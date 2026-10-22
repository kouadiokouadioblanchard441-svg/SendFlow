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

const replitLive = () => ({
  NODE_ENV: "development",
  REPL_ID: "repl-test",
  REPLIT_DEV_DOMAIN: "workspace.invalid",
  SENDFLOW_DATABASE_TARGET: "replit-live",
  DRIZZLE_DATABASE_TARGET: "neon-replit-live",
  SENDFLOW_REPLIT_LIVE_APPROVED: "true",
  NEON_DATABASE_URL_PREVIEW: "postgresql://preview.invalid/sendflow?sslmode=require",
  NEON_DATABASE_URL_PRODUCTION: productionUrl,
});

test("Replit live resolves its dedicated database and forces full TLS verification", () => {
  const url = new URL(resolveRuntimeDatabaseUrl(replitLive()));
  assert.equal(url.hostname, "preview.invalid");
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
});

test("Replit live requires explicit approval, a supported runtime and Replit identity", () => {
  for (const variant of [
    { SENDFLOW_REPLIT_LIVE_APPROVED: undefined },
    { REPL_ID: undefined },
    { REPLIT_DEV_DOMAIN: undefined },
    { NODE_ENV: "test" },
  ]) {
    assert.throws(() => resolveRuntimeDatabaseUrl({ ...replitLive(), ...variant }), /requires explicit approval/);
  }
});

test("Replit live never falls back to production or the managed development database", () => {
  assert.throws(() => resolveRuntimeDatabaseUrl({
    ...replitLive(), NEON_DATABASE_URL_PREVIEW: undefined, DATABASE_URL: developmentUrl,
  }), /NEON_DATABASE_URL_PREVIEW is required/);
  assert.throws(() => resolveRuntimeDatabaseUrl({
    ...replitLive(), NEON_DATABASE_URL_PRODUCTION: undefined,
  }), /NEON_DATABASE_URL_PRODUCTION is required/);
});

test("Replit live rejects the production database including pooled aliases and changed credentials", () => {
  for (const url of [
    productionUrl,
    "postgresql://other@production.invalid:5432/sendflow?sslmode=verify-full",
    "postgresql://production-pooler.invalid/%73endflow?sslmode=require",
  ]) {
    assert.throws(() => resolveRuntimeDatabaseUrl({
      ...replitLive(), NEON_DATABASE_URL_PREVIEW: url,
    }), /distinct from Plesk production/);
  }
});

test("Replit live rejects malformed and insecure URLs without echoing their contents", () => {
  for (const url of [
    "not a database URL",
    "https://preview.invalid/sendflow",
    "postgresql://preview.invalid/",
    "postgresql://preview.invalid/sendflow?sslmode=disable",
    "postgresql://preview.invalid/sendflow?ssl=false",
  ]) {
    assert.throws(() => resolveRuntimeDatabaseUrl({
      ...replitLive(), NEON_DATABASE_URL_PREVIEW: url,
    }), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(url), false);
      return true;
    });
  }
});

test("the explicit Replit live migration target uses the same isolated TLS configuration", () => {
  assert.equal(resolveDrizzleDatabaseUrl(replitLive()), resolveRuntimeDatabaseUrl(replitLive()));
  assert.throws(() => resolveDrizzleDatabaseUrl({
    ...replitLive(), NEON_DATABASE_URL_PREVIEW: productionUrl,
  }), /distinct from Plesk production/);
});
