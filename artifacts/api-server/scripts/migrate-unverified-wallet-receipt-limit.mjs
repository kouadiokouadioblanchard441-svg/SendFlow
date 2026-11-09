import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const planOnly = args.includes("--plan");
const expectedHash = args.find((arg) => arg.startsWith("--expected-hash="))
  ?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--plan", "--verify", "--apply", "--confirm-shared-database"]);

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_REPLIT_LIVE_APPROVED !== "true"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || [apply, verifyOnly, planOnly].filter(Boolean).length !== 1
  || (apply && (!args.includes("--confirm-shared-database") || !expectedHash))
  || (!apply && (args.includes("--confirm-shared-database") || expectedHash))
) {
  console.error("Stopped: use a read-only plan, --verify, or a fingerprinted, explicitly confirmed shared-database apply.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-09-unverified-wallet-receipt-limit.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const connectionOptions = resolveRuntimeDatabaseConnectionOptions(process.env);
const client = new pg.Client({
  ...connectionOptions,
  application_name: "sendflow_unverified_wallet_receipt_limit_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 60_000,
});

const requiredColumns = {
  sf_payment_limits: [
    "id", "minimum_deposit_minor", "minimum_payout_minor", "maximum_payout_daily_minor",
    "minimum_inter_network_minor", "maximum_transfer_minor", "maximum_payin_minor",
    "version", "updated_by", "updated_at",
  ],
  sf_wallets: ["id", "user_id", "balance_minor"],
  sf_payment_intents: [
    "transaction_id", "recipient_total_minor", "state", "ledger_entry_id",
  ],
  sf_transactions: ["id", "user_id"],
  sf_customer_identity_requests: ["user_id", "status"],
};
const expectedConstraintNames = [
  "sf_payment_limits_unverified_incoming_max_check",
  "sf_wallets_unverified_received_minor_nonnegative_check",
  "sf_wallets_unverified_received_minor_safe_integer_check",
];

async function inspectSchema() {
  const tableNames = Object.keys(requiredColumns);
  const result = await client.query(
    `SELECT
       current_database() AS database_name,
       coalesce((
         SELECT jsonb_object_agg(table_name, columns)
         FROM (
           SELECT table_name, array_agg(column_name::text ORDER BY ordinal_position) AS columns
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = ANY($1::text[])
           GROUP BY table_name
         ) AS column_sets
       ), '{}'::jsonb) AS table_columns,
       (SELECT count(*)::integer FROM public.sf_payment_limits WHERE id = 'global') AS global_limit_rows`,
    [tableNames],
  );

  const snapshot = result.rows[0];
  const missing = [];
  for (const [table, expected] of Object.entries(requiredColumns)) {
    const actual = snapshot.table_columns[table] ?? [];
    if (expected.some((column) => !actual.includes(column))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(`Required existing table columns are missing: ${missing.join(", ")}`);
  }
  if (snapshot.global_limit_rows !== 1) {
    throw new Error(`Expected exactly one global payment-limit row; found ${snapshot.global_limit_rows}`);
  }
  return snapshot;
}

async function verifyPostconditions() {
  const result = await client.query(
    `SELECT
       (SELECT count(*)::integer FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sf_payment_limits'
           AND column_name = 'maximum_unverified_incoming_minor') AS limit_column_count,
       (SELECT count(*)::integer FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sf_wallets'
           AND column_name = 'unverified_received_minor') AS wallet_column_count,
       coalesce((
         SELECT array_agg(conname::text ORDER BY conname)
         FROM pg_constraint
         WHERE conrelid IN ('public.sf_payment_limits'::regclass, 'public.sf_wallets'::regclass)
           AND conname = ANY($1::text[])
           AND convalidated
       ), ARRAY[]::text[]) AS validated_constraints,
       (SELECT count(*)::integer FROM public.sf_payment_limits WHERE id = 'global') AS global_limit_rows`,
    [expectedConstraintNames],
  );
  const snapshot = result.rows[0];
  const expectedConstraints = [...expectedConstraintNames].sort();
  if (snapshot.limit_column_count !== 1 || snapshot.wallet_column_count !== 1
    || JSON.stringify(snapshot.validated_constraints) !== JSON.stringify(expectedConstraints)
    || snapshot.global_limit_rows !== 1) {
    throw new Error("The database did not satisfy all migration postconditions.");
  }
  return snapshot;
}

try {
  await client.connect();
  const before = await inspectSchema();
  if (planOnly) {
    console.log(JSON.stringify({
      mode: "plan",
      database: before.database_name,
      migrationHash,
      existingGlobalLimitRows: before.global_limit_rows,
      expectedBackfill: "successful, ledger-backed payment credits for wallets without an approved identity dossier",
      writes: false,
    }, null, 2));
    process.exitCode = 0;
  } else if (verifyOnly) {
    const after = await verifyPostconditions();
    console.log(JSON.stringify({
      mode: "verify",
      database: before.database_name,
      migrationApplied: true,
      validatedConstraints: after.validated_constraints,
    }, null, 2));
  } else {
    if (expectedHash !== migrationHash) {
      throw new Error("The reviewed migration fingerprint does not match the current SQL file.");
    }
    const migrationBody = migrationSql
      .replace(/(^|\n)BEGIN;\s*/i, "$1")
      .replace(/\s*COMMIT;\s*$/, "");
    await client.query("BEGIN");
    try {
      await client.query(migrationBody);
      const after = await verifyPostconditions();
      await client.query("COMMIT");
      console.log(JSON.stringify({
        mode: "apply",
        database: before.database_name,
        migrationApplied: true,
        migrationHash,
        validatedConstraints: after.validated_constraints,
      }, null, 2));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
