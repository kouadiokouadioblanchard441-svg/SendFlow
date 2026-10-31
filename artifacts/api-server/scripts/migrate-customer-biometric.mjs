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
  console.error("Stopped: use the read-only plan, --verify, or --apply --confirm-shared-database --expected-hash=<fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-26-customer-biometric-unlock.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_customer_biometric_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function snapshot() {
  const result = await client.query(`
    SELECT
      to_regclass('public.sf_users') IS NOT NULL AS users_exists,
      to_regclass('public.sf_customer_sessions') IS NOT NULL AS sessions_exists,
      to_regclass('public.sf_customer_biometric_credentials') IS NOT NULL AS credentials_exists,
      to_regclass('public.sf_customer_biometric_challenges') IS NOT NULL AS challenges_exists,
      (SELECT count(*) = 8 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sf_customer_biometric_credentials'
          AND column_name = ANY(ARRAY[
            'id', 'user_id', 'credential_id', 'public_key', 'counter',
            'transports', 'created_at', 'last_used_at'
          ])) AS credentials_columns_compatible,
      (SELECT count(*) = 10 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sf_customer_biometric_challenges') AS challenges_columns_compatible
  `);
  const state = result.rows[0];
  const bothAbsent = !state.credentials_exists && !state.challenges_exists;
  const bothComplete = state.credentials_exists && state.challenges_exists
    && state.credentials_columns_compatible && state.challenges_columns_compatible;
  const safeToApply = state.users_exists && state.sessions_exists && (bothAbsent || bothComplete);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-external", migrationHash, state }))
    .digest("hex");
  return { target: "shared-external", schema: "public", state, safeToApply, alreadyApplied: bothComplete, migrationHash, fingerprint };
}

async function verify() {
  const plan = await snapshot();
  if (!plan.state.credentials_exists || !plan.state.challenges_exists
    || !plan.state.credentials_columns_compatible || !plan.state.challenges_columns_compatible) {
    throw Object.assign(new Error("Biometric schema verification failed."), { code: "BIOMETRIC_SCHEMA_VERIFY_FAILED" });
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
    console.log(JSON.stringify({ target: "shared-external", verified: true, tables: [
      "public.sf_customer_biometric_credentials",
      "public.sf_customer_biometric_challenges",
    ] }));
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
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_customer_biometric_v1'))");
    const plan = await snapshot();
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed migration plan is stale or the target schema is incompatible."), {
        code: "BIOMETRIC_MIGRATION_PLAN_CONFLICT",
      });
    }
    if (!plan.alreadyApplied) await client.query(migrationSql);
    await verify();
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({ target: "shared-external", applied: !plan.alreadyApplied, verified: true, migrationHash, fingerprint: plan.fingerprint }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({ applied: commitAttempted ? "unconfirmed" : false, error: error.code ?? "BIOMETRIC_MIGRATION_FAILED" }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
