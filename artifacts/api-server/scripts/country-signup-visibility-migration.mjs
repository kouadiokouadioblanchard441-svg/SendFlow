import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-09-country-signup-visibility.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || args.some((arg) => !["--apply", "--confirm-shared-database"].includes(arg)
    && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && (!args.includes("--confirm-shared-database") || !expected))
) {
  console.error("Stopped: the shared Supabase target is required; writes need --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const client = new pg.Client({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  application_name: "sendflow_country_signup_visibility_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
});

async function readState() {
  const [table, column, settings] = await Promise.all([
    client.query("SELECT to_regclass('public.sf_countries') IS NOT NULL AS exists"),
    client.query(
      `SELECT data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'sf_countries'
         AND column_name = 'signup_enabled'`,
    ),
    client.query(
      `SELECT s.id, s.default_country_code
       FROM public.sf_registration_settings s
       ORDER BY s.id`,
    ),
  ]);
  const baseline = await client.query(
    `SELECT count(*)::int AS total,
       count(*) FILTER (WHERE enabled)::int AS globally_enabled
     FROM public.sf_countries`,
  );
  const countrySummary = column.rows.length
    ? await client.query(
      `SELECT count(*)::int AS total,
         count(*) FILTER (WHERE enabled)::int AS globally_enabled,
         count(*) FILTER (WHERE signup_enabled)::int AS signup_enabled
       FROM public.sf_countries`,
    )
    : { rows: [{ ...baseline.rows[0], signup_enabled: 0 }] };
  return {
    tableExists: table.rows[0]?.exists === true,
    column: column.rows[0] ?? null,
    countrySummary: countrySummary.rows[0] ?? null,
    settings: settings.rows,
    migrationHash,
  };
}

function createPlan(state) {
  const conflicts = [];
  if (!state.tableExists) conflicts.push("public.sf_countries is missing");
  if (state.settings.length !== 1 || state.settings[0]?.id !== "signup") {
    conflicts.push("Expected exactly one registration-settings row with id signup");
  }
  if (!state.countrySummary || state.countrySummary.total < 1) {
    conflicts.push("The country catalog must contain at least one row");
  }
  if (!state.column && state.countrySummary?.globally_enabled < 1) {
    conflicts.push("At least one existing country must remain globally enabled");
  }
  if (state.column && state.countrySummary?.signup_enabled < 1) {
    conflicts.push("At least one country must remain available for signup");
  }
  if (state.column && (
    state.column.data_type !== "boolean"
    || state.column.is_nullable !== "NO"
    || !/false/i.test(state.column.column_default ?? "")
  )) {
    conflicts.push("Existing signup_enabled column is incompatible; refusing to overwrite country availability");
  }
  return {
    target: "shared-external",
    migrationHash,
    current: state,
    conflicts,
    changes: {
      addSignupEnabledColumn: !state.column,
      initializeExistingSignupAvailability: !state.column,
      setFutureSignupAvailabilityDefault: !state.column,
    },
  };
}

function fingerprint(plan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

try {
  await client.connect();
  if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = createPlan(await readState());
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ ...plan, fingerprint: fingerprint(plan) }, null, 2));
  } else {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow:country-signup-visibility-migration'))");
    const plan = createPlan(await readState());
    if (fingerprint(plan) !== expected || plan.conflicts.length) {
      const error = new Error("Country signup visibility migration plan changed or contains conflicts");
      error.code = "COUNTRY_SIGNUP_VISIBILITY_PLAN_CHANGED";
      throw error;
    }
    if (plan.changes.addSignupEnabledColumn) await client.query(migrationSql);
    const verified = await readState();
    if (
      verified.column?.data_type !== "boolean"
      || verified.column.is_nullable !== "NO"
      || !/false/i.test(verified.column.column_default ?? "")
      || verified.countrySummary?.total < 1
      || verified.countrySummary?.signup_enabled < 1
    ) {
      const error = new Error("Country signup visibility migration postcondition failed");
      error.code = "COUNTRY_SIGNUP_VISIBILITY_POSTCONDITION_FAILED";
      throw error;
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      target: "shared-external",
      applied: true,
      countryCount: verified.countrySummary.total,
      signupEnabledCount: verified.countrySummary.signup_enabled,
      defaultForFutureCountries: false,
    }));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: false,
    error: error.code ?? "COUNTRY_SIGNUP_VISIBILITY_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
