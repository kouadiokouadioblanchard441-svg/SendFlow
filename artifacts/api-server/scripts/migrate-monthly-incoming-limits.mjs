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
  || process.env.NODE_ENV === "production"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || [apply, verifyOnly, planOnly].filter(Boolean).length !== 1
  || (apply && (!args.includes("--confirm-shared-database") || !expectedHash))
  || (!apply && (args.includes("--confirm-shared-database") || expectedHash))
) {
  console.error("Stopped: use a read-only plan, a verification, or a fingerprinted and explicitly confirmed shared-database apply.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-09-monthly-incoming-limits.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  application_name: "sendflow_monthly_incoming_limits_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 60_000,
});

const requiredColumns = {
  sf_payment_limits: [
    "id", "minimum_deposit_minor", "maximum_unverified_incoming_minor",
    "version", "updated_at",
  ],
  sf_users: ["id", "status", "updated_at"],
  sf_wallet_ledger: [
    "user_id", "direction", "amount_minor", "currency", "admin_user_id", "created_at",
  ],
};
const expectedConstraints = [
  "sf_payment_limits_verified_incoming_max_check",
  "sf_users_monthly_incoming_limit_override_check",
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
  if (missing.length) throw new Error(`Required existing columns are missing: ${missing.join(", ")}`);
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
           AND column_name = 'maximum_verified_incoming_minor') AS verified_cap_column_count,
       (SELECT count(*)::integer FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'sf_users'
           AND column_name = 'monthly_incoming_limit_override_minor') AS override_column_count,
       coalesce((
         SELECT array_agg(conname::text ORDER BY conname)
         FROM pg_constraint
         WHERE conrelid IN ('public.sf_payment_limits'::regclass, 'public.sf_users'::regclass)
           AND conname = ANY($1::text[])
           AND convalidated
       ), ARRAY[]::text[]) AS validated_constraints,
       (SELECT count(*)::integer FROM public.sf_payment_limits WHERE id = 'global') AS global_limit_rows,
       (SELECT maximum_verified_incoming_minor
         FROM public.sf_payment_limits WHERE id = 'global') AS verified_limit_minor`,
    [expectedConstraints],
  );
  const snapshot = result.rows[0];
  if (
    snapshot.verified_cap_column_count !== 1
    || snapshot.override_column_count !== 1
    || JSON.stringify(snapshot.validated_constraints) !== JSON.stringify([...expectedConstraints].sort())
    || snapshot.global_limit_rows !== 1
    || !Number.isSafeInteger(snapshot.verified_limit_minor)
    || snapshot.verified_limit_minor < 0
    || snapshot.verified_limit_minor > 2_147_483_647
  ) {
    throw new Error("The database did not satisfy every monthly incoming-limit migration postcondition.");
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
      paymentLimitColumns: before.table_columns.sf_payment_limits,
      userColumns: before.table_columns.sf_users,
      writes: false,
    }, null, 2));
  } else if (verifyOnly) {
    const after = await verifyPostconditions();
    console.log(JSON.stringify({
      mode: "verify",
      database: before.database_name,
      migrationApplied: true,
      validatedConstraints: after.validated_constraints,
      maximumVerifiedIncomingMinor: after.verified_limit_minor,
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
        maximumVerifiedIncomingMinor: after.verified_limit_minor,
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
