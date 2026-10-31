import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--apply", "--verify", "--confirm-shared-database"]);

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && verifyOnly)
  || (verifyOnly && (args.includes("--confirm-shared-database") || expected))
  || (apply && (!args.includes("--confirm-shared-database") || !expected))
) {
  console.error("Stopped: use the read-only plan, --verify, or --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-24-customer-payment-links.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_customer_payment_links_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function getPlanState() {
  const result = await client.query(`
    SELECT
      to_regclass('public.sf_customer_payment_links') IS NOT NULL AS table_exists,
      to_regclass('public.sf_customer_payment_links_public_token_uq') IS NOT NULL AS token_index_exists,
      to_regclass('public.sf_customer_payment_links_owner_idempotency_uq') IS NOT NULL AS idempotency_index_exists,
      to_regclass('public.sf_customer_payment_links_owner_created_idx') IS NOT NULL AS owner_index_exists
  `);
  const state = result.rows[0];
  const safeToApply = Object.values(state).every((value) => value === false);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-external", migrationHash, state }))
    .digest("hex");
  return {
    target: "shared-external",
    schema: "public",
    table: "sf_customer_payment_links",
    tableExists: state.table_exists,
    conflictingNamedIndexes: [
      state.token_index_exists,
      state.idempotency_index_exists,
      state.owner_index_exists,
    ].some(Boolean),
    safeToApply,
    writes: false,
    migrationHash,
    fingerprint,
  };
}

async function verifyCreatedSchema() {
  const columns = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sf_customer_payment_links'
    ORDER BY ordinal_position
  `);
  const constraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.sf_customer_payment_links'::regclass
      AND contype <> 'n'
  `);
  const indexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'sf_customer_payment_links'
  `);
  const rows = await client.query("SELECT count(*)::int AS count FROM public.sf_customer_payment_links");

  const expectedColumns = [
    ["id", "uuid", null, "NO"],
    ["user_id", "text", null, "NO"],
    ["public_token", "character varying", 43, "NO"],
    ["idempotency_key", "uuid", null, "NO"],
    ["request_hash", "character varying", 64, "NO"],
    ["currency", "character varying", 3, "NO"],
    ["amount_minor", "bigint", null, "NO"],
    ["description", "character varying", 240, "NO"],
    ["payment_method", "character varying", 20, "NO"],
    ["expires_at", "timestamp with time zone", null, "YES"],
    ["maximum_uses", "integer", null, "YES"],
    ["usage_count", "integer", null, "NO"],
    ["return_url", "character varying", 2048, "YES"],
    ["custom_suffix", "character varying", 32, "YES"],
    ["status", "character varying", 24, "NO"],
    ["image_data", "bytea", null, "YES"],
    ["image_size_bytes", "integer", null, "YES"],
    ["created_at", "timestamp with time zone", null, "NO"],
    ["updated_at", "timestamp with time zone", null, "NO"],
  ];
  const expectedConstraints = [
    "sf_customer_payment_links_pkey",
    "sf_customer_payment_links_user_id_fkey",
    "sf_customer_payment_links_token_check",
    "sf_customer_payment_links_request_hash_check",
    "sf_customer_payment_links_currency_check",
    "sf_customer_payment_links_amount_check",
    "sf_customer_payment_links_description_check",
    "sf_customer_payment_links_payment_method_check",
    "sf_customer_payment_links_maximum_uses_check",
    "sf_customer_payment_links_usage_count_check",
    "sf_customer_payment_links_suffix_check",
    "sf_customer_payment_links_return_url_check",
    "sf_customer_payment_links_status_check",
    "sf_customer_payment_links_image_data_check",
  ];
  const expectedIndexes = [
    "sf_customer_payment_links_pkey",
    "sf_customer_payment_links_public_token_uq",
    "sf_customer_payment_links_owner_idempotency_uq",
    "sf_customer_payment_links_owner_created_idx",
  ];
  const sorted = (values) => values.sort();
  const exact = (actual, desired) => JSON.stringify(sorted(actual)) === JSON.stringify(sorted(desired));
  const actualColumns = columns.rows.map((row) => [
    row.column_name,
    row.data_type,
    row.character_maximum_length,
    row.is_nullable,
  ]);
  const rowCount = rows.rows[0]?.count;
  if (
    JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)
    || !exact(constraints.rows.map((row) => row.conname), expectedConstraints)
    || !exact(indexes.rows.map((row) => row.indexname), expectedIndexes)
    || rowCount !== 0
  ) {
    throw Object.assign(new Error("Payment-link schema verification failed."), {
      code: "SCHEMA_VERIFY_FAILED",
      details: {
        actualColumns,
        actualConstraints: constraints.rows.map((row) => row.conname).sort(),
        actualIndexes: indexes.rows.map((row) => row.indexname).sort(),
        rowCount,
      },
    });
  }
}

let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    await verifyCreatedSchema();
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      target: "shared-external",
      verified: true,
      table: "public.sf_customer_payment_links",
      rows: 0,
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
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_customer_payment_links_v1'))");
    const plan = await getPlanState();
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed plan is stale or the target contains conflicting objects."), {
        code: "MIGRATION_PLAN_CONFLICT",
      });
    }
    await client.query(migrationSql);
    await verifyCreatedSchema();
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-external",
      applied: true,
      verified: true,
      table: "public.sf_customer_payment_links",
      rowsCreated: 0,
      migrationHash,
      fingerprint: plan.fingerprint,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: commitAttempted ? "unconfirmed" : false,
    error: error.code ?? "PAYMENT_LINKS_MIGRATION_FAILED",
    ...(error.details ? { verification: error.details } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
