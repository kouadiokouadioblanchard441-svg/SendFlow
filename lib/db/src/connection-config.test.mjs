import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveDrizzleDatabaseUrl,
  resolveRuntimeDatabaseConnectionOptions,
  resolveRuntimeDatabaseUrl,
  resolveReplitLiveDatabaseUrl,
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
      SUPABASE_DATABASE_URL: productionUrl,
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
        SUPABASE_DATABASE_URL: productionUrl,
      }),
    /DATABASE_URL is required for the Replit development database/,
  );
});

test("runtime shared external database uses its server secret with verified TLS", () => {
  const url = new URL(resolveRuntimeDatabaseUrl({
    NODE_ENV: "development",
    REPL_ID: "repl-test",
    SENDFLOW_DATABASE_TARGET: "shared-external",
    DATABASE_URL: developmentUrl,
    SUPABASE_DATABASE_URL: productionUrl,
  }));
  assert.equal(url.hostname, "production.invalid");
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
});

test("shared external connection options apply the trusted CA with hostname verification", () => {
  const options = resolveRuntimeDatabaseConnectionOptions({
    NODE_ENV: "development",
    REPL_ID: "repl-test",
    SENDFLOW_DATABASE_TARGET: "shared-external",
    SUPABASE_DATABASE_URL: `${productionUrl}?sslmode=require`,
    DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----",
    SENDFLOW_REPLIT_LIVE_APPROVED: "true",
    SENDFLOW_SHARED_DATABASE_LIVE_APPROVED: "true",
  });
  const url = new URL(options.connectionString);
  assert.equal(url.hostname, "production.invalid");
  assert.equal(url.searchParams.has("sslmode"), false);
  assert.deepEqual(options.ssl, {
    ca: "-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----",
    rejectUnauthorized: true,
    servername: "production.invalid",
  });
});

test("shared external connection options require the trusted CA", () => {
  assert.throws(() => resolveRuntimeDatabaseConnectionOptions({
    NODE_ENV: "development",
    REPL_ID: "repl-test",
    SENDFLOW_DATABASE_TARGET: "shared-external",
    SUPABASE_DATABASE_URL: productionUrl,
  }), /DATABASE_CA_CERT is required/);
});

test("runtime shared external database fails closed outside Replit development", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        SENDFLOW_DATABASE_TARGET: "shared-external",
        SUPABASE_DATABASE_URL: productionUrl,
      }),
    /can only be used inside Replit/,
  );

  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "production",
        REPL_ID: "repl-test",
        SENDFLOW_DATABASE_TARGET: "shared-external",
        SUPABASE_DATABASE_URL: productionUrl,
      }),
    /cannot be used when NODE_ENV=production/,
  );
});

test("runtime shared external database requires its configured secret", () => {
  assert.throws(
    () =>
      resolveRuntimeDatabaseUrl({
        NODE_ENV: "development",
        REPL_ID: "repl-test",
        SENDFLOW_DATABASE_TARGET: "shared-external",
        DATABASE_URL: developmentUrl,
      }),
    /SUPABASE_DATABASE_URL is required/,
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
        DATABASE_URL: productionUrl,
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
        DATABASE_URL: productionUrl,
      }),
    /requires NODE_ENV=production/,
  );

  assert.equal(
    resolveRuntimeDatabaseUrl({
      NODE_ENV: "production",
      SENDFLOW_DATABASE_TARGET: "production",
      DATABASE_URL: productionUrl,
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
      SUPABASE_DATABASE_URL: productionUrl,
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
        DRIZZLE_DATABASE_TARGET: "production",
        DATABASE_URL: productionUrl,
      }),
    /cannot run inside Replit/,
  );
});

test("Drizzle production target works only in the Plesk environment", () => {
  assert.equal(
    resolveDrizzleDatabaseUrl({
      NODE_ENV: "production",
      DRIZZLE_DATABASE_TARGET: "production",
      DATABASE_URL: productionUrl,
    }),
    productionUrl,
  );

  assert.throws(
    () =>
      resolveDrizzleDatabaseUrl({
        NODE_ENV: "development",
        DRIZZLE_DATABASE_TARGET: "production",
        DATABASE_URL: productionUrl,
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
  SENDFLOW_DATABASE_TARGET: "shared-external",
  SENDFLOW_REPLIT_LIVE_APPROVED: "true",
  SENDFLOW_SHARED_DATABASE_LIVE_APPROVED: "true",
  SUPABASE_DATABASE_URL: productionUrl,
});

test("approved Replit live uses the connected real database and forces verified TLS", () => {
  const url = new URL(resolveRuntimeDatabaseUrl(replitLive()));
  assert.equal(url.hostname, "production.invalid");
  assert.equal(url.searchParams.get("sslmode"), "verify-full");
  assert.equal(resolveReplitLiveDatabaseUrl(replitLive()), url.toString());
});

test("Replit shared live requires both approvals, development runtime and Replit identity", () => {
  for (const variant of [
    { SENDFLOW_REPLIT_LIVE_APPROVED: undefined },
    { SENDFLOW_SHARED_DATABASE_LIVE_APPROVED: undefined },
    { REPL_ID: undefined },
    { REPLIT_DEV_DOMAIN: undefined },
    { NODE_ENV: "test" },
    { NODE_ENV: "production" },
    { SENDFLOW_DATABASE_TARGET: "production" },
  ]) {
    assert.throws(() => resolveReplitLiveDatabaseUrl({ ...replitLive(), ...variant }), /requires explicit approval/);
  }
});

test("Replit live never falls back to another database when the connected secret is missing", () => {
  assert.throws(() => resolveReplitLiveDatabaseUrl({
    ...replitLive(), SUPABASE_DATABASE_URL: undefined,
    DATABASE_URL: developmentUrl,
  }), /SUPABASE_DATABASE_URL is required/);
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
      ...replitLive(), SUPABASE_DATABASE_URL: url,
    }), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(url), false);
      return true;
    });
  }
});

test("Replit live payment approval does not authorize production schema pushes", () => {
  assert.throws(() => resolveDrizzleDatabaseUrl({
    ...replitLive(), DRIZZLE_DATABASE_TARGET: "production",
  }), /requires NODE_ENV=production/);
});
