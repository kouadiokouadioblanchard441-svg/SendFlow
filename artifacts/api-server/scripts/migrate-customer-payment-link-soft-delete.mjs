import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--apply", "--verify", "--confirm-shared-database"]);

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && verifyOnly)
  || (verifyOnly && (args.includes("--confirm-shared-database") || expected))
  || (apply && (!args.includes("--confirm-shared-database") || !expected))
) {
  console.error("Stopped: use the read-only plan, --verify, or --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-25-customer-payment-link-soft-delete.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_linkflow_soft_delete_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function getPlanState() {
  const result = await client.query(`
    SELECT
      to_regclass('public.sf_customer_payment_links') IS NOT NULL AS table_exists,
      (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sf_customer_payment_links'
          AND column_name = 'deleted_at') AS deleted_at_type,
      (SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sf_customer_payment_links'
          AND column_name = 'deleted_at') AS deleted_at_nullable
  `);
  const state = result.rows[0];
  const columnIsCompatible = state.deleted_at_type === null
    || (state.deleted_at_type === "timestamp with time zone" && state.deleted_at_nullable === "YES");
  const safeToApply = state.table_exists === true && columnIsCompatible;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-external", migrationHash, state }))
    .digest("hex");
  return {
    target: "shared-external",
    schema: "public",
    table: "sf_customer_payment_links",
    column: "deleted_at",
    columnExists: state.deleted_at_type !== null,
    safeToApply,
    writes: false,
    migrationHash,
    fingerprint,
  };
}

async function verifyColumn() {
  const result = await client.query(`
    SELECT data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sf_customer_payment_links'
      AND column_name = 'deleted_at'
  `);
  if (
    result.rows.length !== 1
    || result.rows[0].data_type !== "timestamp with time zone"
    || result.rows[0].is_nullable !== "YES"
  ) {
    throw Object.assign(new Error("Soft-delete column verification failed."), {
      code: "SOFT_DELETE_SCHEMA_VERIFY_FAILED",
    });
  }
}

let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    await verifyColumn();
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      target: "shared-external",
      verified: true,
      table: "public.sf_customer_payment_links",
      column: "deleted_at",
    }));
  } else if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = await getPlanState();
    await client.query("ROLLBACK");
    console.log(JSON.stringify(plan));
  } else {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_linkflow_soft_delete_v1'))");
    const plan = await getPlanState();
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed plan is stale or the target schema is incompatible."), {
        code: "SOFT_DELETE_MIGRATION_PLAN_CONFLICT",
      });
    }
    await client.query(migrationSql);
    await verifyColumn();
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-external",
      applied: true,
      verified: true,
      table: "public.sf_customer_payment_links",
      column: "deleted_at",
      migrationHash,
      fingerprint: plan.fingerprint,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: commitAttempted ? "unconfirmed" : false,
    error: error.code ?? "SOFT_DELETE_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
