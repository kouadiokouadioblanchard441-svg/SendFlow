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
  new URL("../../../lib/db/migrations/2026-10-26-linkflow-variable-amount.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_linkflow_variable_amount_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

const compact = (definition = "") => definition.toLowerCase().replace(/\s+/g, "");
const hasMaximumAmount = (value) => value.includes("amount_minor<='9007199254740991'")
  || value.includes("amount_minor<=9007199254740991");
const isLegacyAmountCheck = (definition) => {
  const value = compact(definition);
  return value.includes("'xof'") && value.includes("'xaf'")
    && value.includes("amount_minor>=10")
    && hasMaximumAmount(value);
};
const isTargetAmountCheck = (definition) => {
  const value = compact(definition);
  return value.includes("'xof'") && value.includes("'xaf'")
    && value.includes("amount_minor>=0")
    && value.includes("amount_minor>=10")
    && hasMaximumAmount(value);
};
const isLegacyDescriptionCheck = (definition) => {
  const value = compact(definition);
  return value.includes("length(btrim") && value.includes(">=2") && value.includes("<=240");
};
const isTargetDescriptionCheck = (definition) => {
  const value = compact(definition);
  return value.includes("length(btrim") && value.includes(">=0") && value.includes("<=240");
};

async function getPlanState() {
  const tableResult = await client.query(`
    SELECT
      to_regclass('public.sf_customer_payment_links') IS NOT NULL AS table_exists,
      (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sf_customer_payment_links'
          AND column_name='amount_minor') AS amount_type,
      (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='sf_customer_payment_links'
          AND column_name='description') AS description_type
  `);
  const constraintsResult = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition, convalidated
    FROM pg_constraint
    WHERE conrelid='public.sf_customer_payment_links'::regclass
      AND conname IN ('sf_customer_payment_links_amount_check','sf_customer_payment_links_description_check')
    ORDER BY conname
  `);
  const state = {
    ...tableResult.rows[0],
    constraints: constraintsResult.rows,
  };
  const amount = state.constraints.find((item) => item.conname === "sf_customer_payment_links_amount_check");
  const description = state.constraints.find((item) => item.conname === "sf_customer_payment_links_description_check");
  const tableCompatible = state.table_exists
    && state.amount_type === "bigint"
    && state.description_type === "character varying";
  const amountKnown = amount?.convalidated
    && (isLegacyAmountCheck(amount.definition) || isTargetAmountCheck(amount.definition));
  const descriptionKnown = description?.convalidated
    && (isLegacyDescriptionCheck(description.definition) || isTargetDescriptionCheck(description.definition));
  const alreadyApplied = Boolean(
    tableCompatible
    && amount?.convalidated
    && description?.convalidated
    && isTargetAmountCheck(amount.definition)
    && isTargetDescriptionCheck(description.definition),
  );
  const safeToApply = Boolean(tableCompatible && amountKnown && descriptionKnown);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-external", migrationHash, state }))
    .digest("hex");
  return {
    target: "shared-external",
    table: "public.sf_customer_payment_links",
    safeToApply,
    alreadyApplied,
    writes: false,
    migrationHash,
    fingerprint,
  };
}

async function verifyTarget() {
  const result = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS definition, convalidated
    FROM pg_constraint
    WHERE conrelid='public.sf_customer_payment_links'::regclass
      AND conname IN ('sf_customer_payment_links_amount_check','sf_customer_payment_links_description_check')
  `);
  const amount = result.rows.find((item) => item.conname === "sf_customer_payment_links_amount_check");
  const description = result.rows.find((item) => item.conname === "sf_customer_payment_links_description_check");
  if (
    !amount?.convalidated
    || !description?.convalidated
    || !isTargetAmountCheck(amount.definition)
    || !isTargetDescriptionCheck(description.definition)
  ) {
    throw Object.assign(new Error("Variable-amount constraints did not verify."), {
      code: "VARIABLE_AMOUNT_SCHEMA_VERIFY_FAILED",
    });
  }
}

let transactionOpen = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    await verifyTarget();
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      target: "shared-external",
      verified: true,
      table: "public.sf_customer_payment_links",
      amountZeroAllowedForXof: true,
      descriptionMayBeEmpty: true,
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
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_linkflow_variable_amount_v1'))");
    const plan = await getPlanState();
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed plan is stale or the target schema is incompatible."), {
        code: "VARIABLE_AMOUNT_MIGRATION_PLAN_CONFLICT",
      });
    }
    if (!plan.alreadyApplied) {
      const transactionalSql = migrationSql
        .replace(/^\s*BEGIN\s*;\s*/i, "")
        .replace(/\s*COMMIT\s*;\s*$/i, "");
      await client.query(transactionalSql);
    }
    await verifyTarget();
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-external",
      applied: !plan.alreadyApplied,
      verified: true,
      table: "public.sf_customer_payment_links",
      migrationHash,
      fingerprint: plan.fingerprint,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: false,
    error: /^[0-9A-Z]{5}$/.test(error?.code ?? "") ? error.code : "VARIABLE_AMOUNT_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
