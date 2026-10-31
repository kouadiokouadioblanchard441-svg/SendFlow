import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))
  ?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--apply", "--confirm-shared-database"]);
if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && (!args.includes("--confirm-shared-database") || !expected))
) {
  console.error("Stopped: use the read-only plan, or --apply --confirm-shared-database --expected-hash=<fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-28-developer-test-key-prefix.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_developer_test_key_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function snapshot() {
  const { rows } = await client.query(`
    SELECT
      to_regclass('public.sf_developer_api_keys') IS NOT NULL AS table_exists,
      (SELECT convalidated FROM pg_constraint
        WHERE conrelid = to_regclass('public.sf_developer_api_keys')
          AND conname = 'sf_developer_api_keys_public_key_check') AS constraint_validated,
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = to_regclass('public.sf_developer_api_keys')
          AND conname = 'sf_developer_api_keys_public_key_check') AS constraint_definition
  `);
  const state = rows[0];
  const definition = state.constraint_definition?.replace(/\s+/g, "") ?? "";
  const alreadyApplied = state.table_exists
    && state.constraint_validated
    && definition.includes("^sfpk_(live|test)_[A-Za-z0-9_-]{43}$");
  const safeToApply = state.table_exists
    && state.constraint_validated
    && definition.includes("^sfpk_live_[A-Za-z0-9_-]{43}$")
    && !definition.includes("sfpk_(live|test)_");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-external", migrationHash, state }))
    .digest("hex");
  return { target: "shared-external", migrationHash, state, safeToApply, alreadyApplied, fingerprint };
}

const migrationLock = "sendflow_developer_test_key_prefix_v1";
let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = await snapshot();
    await client.query("ROLLBACK");
    console.log(JSON.stringify(plan));
  } else {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [migrationLock]);
    const plan = await snapshot();
    if (plan.fingerprint !== expected || (!plan.safeToApply && !plan.alreadyApplied)) {
      throw Object.assign(new Error("The reviewed migration plan is stale or incompatible."), {
        code: "DEVELOPER_TEST_KEY_MIGRATION_CONFLICT",
      });
    }
    if (!plan.alreadyApplied) await client.query(migrationSql);
    const verified = await snapshot();
    if (!verified.alreadyApplied) {
      throw Object.assign(new Error("Developer test-key constraint verification failed."), {
        code: "DEVELOPER_TEST_KEY_MIGRATION_VERIFY_FAILED",
      });
    }
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-external",
      applied: !plan.alreadyApplied,
      verified: true,
      migrationHash,
      fingerprint: plan.fingerprint,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: commitAttempted ? "unconfirmed" : false,
    error: error.code ?? "DEVELOPER_TEST_KEY_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
