import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--apply", "--verify", "--confirm-shared-neon"]);
if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-neon"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_SHARED_NEON_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && verifyOnly)
  || (verifyOnly && (args.includes("--confirm-shared-neon") || expected))
  || (apply && (!args.includes("--confirm-shared-neon") || !expected))
) {
  console.error("Stopped: use the read-only plan, --verify, or --apply --confirm-shared-neon --expected-hash=<fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-26-customer-biometric-rp-scope.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_customer_biometric_rp_scope_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function snapshot() {
  const result = await client.query(`
    SELECT
      to_regclass('public.sf_customer_biometric_credentials') IS NOT NULL AS table_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sf_customer_biometric_credentials'
          AND column_name='rp_id' AND data_type='text' AND is_nullable='NO'
      ) AS rp_id_exists,
      (SELECT count(*) FROM public.sf_customer_biometric_credentials) AS credential_rows,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname='public' AND indexname='sf_customer_biometric_user_rp_idx'
      ) AS index_exists
  `);
  const state = result.rows[0];
  const safeToApply = state.table_exists && (
    (state.rp_id_exists && state.index_exists)
    || (!state.rp_id_exists && Number(state.credential_rows) === 0)
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-neon", migrationHash, state }))
    .digest("hex");
  return {
    target: "shared-neon",
    schema: "public",
    table: "sf_customer_biometric_credentials",
    state,
    safeToApply,
    alreadyApplied: state.rp_id_exists && state.index_exists,
    migrationHash,
    fingerprint,
  };
}

async function verify() {
  const plan = await snapshot();
  if (!plan.state.rp_id_exists || !plan.state.index_exists) {
    throw Object.assign(new Error("RP ID scope verification failed."), { code: "BIOMETRIC_RP_SCOPE_VERIFY_FAILED" });
  }
}

let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    await verify();
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ target: "shared-neon", verified: true, column: "rp_id" }));
  } else if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = await snapshot();
    await client.query("ROLLBACK");
    console.log(JSON.stringify(plan));
  } else {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_customer_biometric_rp_scope_v1'))");
    const plan = await snapshot();
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed RP ID migration plan is stale or the table contains unscoped credentials."), {
        code: "BIOMETRIC_RP_SCOPE_PLAN_CONFLICT",
      });
    }
    if (!plan.alreadyApplied) await client.query(migrationSql);
    await verify();
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({ target: "shared-neon", applied: !plan.alreadyApplied, verified: true, migrationHash, fingerprint: plan.fingerprint }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ applied: commitAttempted ? "unconfirmed" : false, error: error.code ?? "BIOMETRIC_RP_SCOPE_MIGRATION_FAILED" }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
