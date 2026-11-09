import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseConnectionOptions } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))?.slice("--expected-hash=".length);
const actor = "system:signup-default-country";
const sql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-09-signup-default-country.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(sql).digest("hex");

if (process.env.SENDFLOW_DATABASE_TARGET !== "shared-external" ||
  args.some((arg) => !["--apply", "--confirm-shared-database"].includes(arg) &&
    !/^--expected-hash=[a-f0-9]{64}$/.test(arg)) ||
  (apply && (!args.includes("--confirm-shared-database") || !expected))) {
  console.error("Stopped: shared Supabase target required; writes need --apply --confirm-shared-database --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const client = new pg.Client({
  ...resolveRuntimeDatabaseConnectionOptions(process.env),
  application_name: "sendflow_signup_default_country_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
});

async function readState() {
  const [settingsRows, countryRows, column, constraint] = await Promise.all([
    client.query("SELECT id FROM public.sf_registration_settings ORDER BY id"),
    client.query(
      "SELECT country_code, enabled FROM public.sf_countries WHERE country_code = $1",
      ["ci"],
    ),
    client.query(
      `SELECT data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'sf_registration_settings'
         AND column_name = 'default_country_code'`,
    ),
    client.query(
      `SELECT convalidated AS validated
       FROM pg_constraint
       WHERE conname = 'sf_registration_settings_default_country_code_fk'
         AND conrelid = 'public.sf_registration_settings'::regclass`,
    ),
  ]);
  const hasColumn = column.rows.length === 1;
  const settings = hasColumn
    ? await client.query(
      `SELECT s.id, s.default_country_code, s.version, c.enabled AS default_country_enabled
       FROM public.sf_registration_settings s
       LEFT JOIN public.sf_countries c ON c.country_code = s.default_country_code
       ORDER BY s.id`,
    )
    : await client.query(
      "SELECT id, NULL::varchar AS default_country_code, version, false AS default_country_enabled FROM public.sf_registration_settings ORDER BY id",
    );
  return {
    settings: settings.rows,
    country: countryRows.rows[0] ?? null,
    column: column.rows[0] ?? null,
    foreignKey: constraint.rows[0] ?? null,
    migrationHash,
  };
}

function createPlan(state) {
  const conflicts = [];
  const schemaComplete = state.column?.data_type === "character varying" &&
    state.column.is_nullable === "NO" &&
    state.foreignKey?.validated === true;
  if (state.settings.length !== 1 || state.settings[0]?.id !== "signup") {
    conflicts.push("Expected exactly one registration-settings row with id signup");
  }
  if (!schemaComplete && !state.country?.enabled) {
    conflicts.push("The enabled Côte d’Ivoire country row is missing");
  }
  if (state.column && state.column.data_type !== "character varying") {
    conflicts.push("Existing default_country_code has an unexpected type");
  }
  return {
    target: "shared-external",
    migrationHash,
    current: state,
    conflicts,
    changes: {
      addColumn: !state.column,
      setDefaultToCoteDIvoire: !schemaComplete && state.settings[0]?.default_country_code !== "ci",
      addForeignKey: state.foreignKey?.validated !== true,
      setNotNull: state.column?.is_nullable !== "NO",
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
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow:signup-default-country'))");
    const plan = createPlan(await readState());
    if (fingerprint(plan) !== expected || plan.conflicts.length) {
      const error = new Error("Signup default-country plan changed or contains conflicts");
      error.code = "SIGNUP_DEFAULT_COUNTRY_PLAN_CHANGED";
      throw error;
    }
    if (plan.changes.addColumn || plan.changes.setDefaultToCoteDIvoire ||
      plan.changes.addForeignKey || plan.changes.setNotNull) {
      await client.query(sql);
    }
    const verified = await readState();
    if (verified.settings.length !== 1 ||
      verified.settings[0]?.id !== "signup" ||
      !verified.settings[0]?.default_country_code ||
      !verified.settings[0]?.default_country_enabled ||
      !verified.column ||
      verified.column.data_type !== "character varying" ||
      verified.column.is_nullable !== "NO" ||
      !verified.foreignKey?.validated ||
      !verified.country?.enabled) {
      const error = new Error("Signup default-country migration postcondition failed");
      error.code = "SIGNUP_DEFAULT_COUNTRY_POSTCONDITION_FAILED";
      throw error;
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      target: "shared-external",
      applied: true,
      defaultCountryCode: verified.settings[0].default_country_code,
      databaseConfigured: true,
      foreignKeyValidated: true,
    }));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: false,
    error: error.code ?? "SIGNUP_DEFAULT_COUNTRY_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
