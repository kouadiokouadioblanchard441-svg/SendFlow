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
  || process.env.SENDFLOW_REPLIT_LIVE_APPROVED !== "true"
  || process.env.SENDFLOW_SHARED_NEON_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || (apply && verifyOnly)
  || (verifyOnly && (args.includes("--confirm-shared-neon") || expected))
  || (apply && (!args.includes("--confirm-shared-neon") || !expected))
) {
  console.error("Stopped: use a read-only plan, --verify, or --apply --confirm-shared-neon --expected-hash=<reviewed fingerprint>.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-10-26-linkflow-pricing-rates.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const client = new pg.Client({
  connectionString: resolveRuntimeDatabaseUrl(process.env),
  application_name: "sendflow_linkflow_pricing_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function getSnapshot() {
  const schemaResult = await client.query(`
    SELECT
      to_regclass('public.sf_operator_catalog') IS NOT NULL AS catalog_exists,
      to_regclass('public.sf_operator_pricing_rates') IS NOT NULL AS rates_exists,
      (
        SELECT count(*) = 7
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_operator_pricing_rates'
          AND column_name = ANY(ARRAY[
            'operator_id', 'country_code', 'category_id', 'fee_percent',
            'version', 'created_by', 'updated_by'
          ])
      ) AS pricing_columns_compatible,
      EXISTS (
        SELECT 1
        FROM pg_index AS i
        JOIN pg_class AS t ON t.oid = i.indrelid
        JOIN pg_namespace AS n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'sf_operator_pricing_rates'
          AND i.indisunique
          AND i.indpred IS NULL
          AND (
            SELECT string_agg(a.attname, ',' ORDER BY key_column.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
            JOIN pg_attribute AS a
              ON a.attrelid = t.oid AND a.attnum = key_column.attnum
          ) = 'operator_id,category_id'
      ) AS unique_operator_category
  `);
  const schema = schemaResult.rows[0];
  const safeSchema = schema.catalog_exists
    && schema.rates_exists
    && schema.pricing_columns_compatible
    && schema.unique_operator_category;

  if (!safeSchema) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ target: "shared-neon", migrationHash, schema }))
      .digest("hex");
    return { schema, safeSchema: false, rows: [], fingerprint };
  }

  const rowsResult = await client.query(`
    SELECT
      operator.operator_id,
      operator.country_code,
      deposit_rate.fee_percent::text AS deposit_fee,
      linkflow_rate.fee_percent::text AS linkflow_fee,
      linkflow_rate.operator_id IS NOT NULL AS has_linkflow
    FROM public.sf_operator_catalog AS operator
    LEFT JOIN public.sf_operator_pricing_rates AS deposit_rate
      ON deposit_rate.operator_id = operator.operator_id
      AND deposit_rate.category_id = 'deposit'
    LEFT JOIN public.sf_operator_pricing_rates AS linkflow_rate
      ON linkflow_rate.operator_id = operator.operator_id
      AND linkflow_rate.category_id = 'linkflow'
    ORDER BY operator.operator_id
  `);
  const rows = rowsResult.rows;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ target: "shared-neon", migrationHash, schema, rows }))
    .digest("hex");
  return { schema, safeSchema: true, rows, fingerprint };
}

function planSummary(snapshot) {
  const rows = snapshot.rows;
  return {
    target: "shared-neon",
    table: "public.sf_operator_pricing_rates",
    safeToApply: snapshot.safeSchema && rows.length > 0,
    operatorCount: rows.length,
    existingLinkflowRates: rows.filter((row) => row.has_linkflow).length,
    ratesToCreate: rows.filter((row) => !row.has_linkflow).length,
    migrationHash,
    fingerprint: snapshot.fingerprint,
  };
}

function assertResult(before, after) {
  if (!after.safeSchema || before.rows.length !== after.rows.length) {
    throw Object.assign(new Error("LinkFlow pricing migration verification failed."), {
      code: "LINKFLOW_PRICING_VERIFY_FAILED",
    });
  }
  const afterById = new Map(after.rows.map((row) => [row.operator_id, row]));
  for (const original of before.rows) {
    const current = afterById.get(original.operator_id);
    if (
      !current
      || current.country_code !== original.country_code
      || current.deposit_fee !== original.deposit_fee
      || !current.has_linkflow
      || (original.has_linkflow && current.linkflow_fee !== original.linkflow_fee)
      || (!original.has_linkflow && current.linkflow_fee !== null)
    ) {
      throw Object.assign(new Error("LinkFlow pricing migration verification failed."), {
        code: "LINKFLOW_PRICING_VERIFY_FAILED",
      });
    }
  }
}

let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    const snapshot = await getSnapshot();
    if (
      !snapshot.safeSchema
      || snapshot.rows.length === 0
      || snapshot.rows.some((row) => !row.has_linkflow)
    ) {
      throw Object.assign(new Error("LinkFlow pricing rates are not fully initialized."), {
        code: "LINKFLOW_PRICING_VERIFY_FAILED",
      });
    }
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      target: "shared-neon",
      verified: true,
      operatorCount: snapshot.rows.length,
      linkflowRateCount: snapshot.rows.length,
    }));
  } else if (!apply) {
    await client.query("BEGIN READ ONLY");
    const plan = planSummary(await getSnapshot());
    await client.query("ROLLBACK");
    console.log(JSON.stringify(plan));
  } else {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('sendflow_linkflow_pricing_rates_v1'))");
    const before = await getSnapshot();
    const plan = planSummary(before);
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed plan is stale or the target schema is incompatible."), {
        code: "LINKFLOW_PRICING_PLAN_CONFLICT",
      });
    }
    const transactionalSql = migrationSql
      .replace(/^\s*BEGIN\s*;\s*/i, "")
      .replace(/\s*COMMIT\s*;\s*$/i, "");
    await client.query(transactionalSql);
    const after = await getSnapshot();
    assertResult(before, after);
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-neon",
      applied: plan.ratesToCreate > 0,
      verified: true,
      operatorCount: after.rows.length,
      ratesCreated: plan.ratesToCreate,
      existingLinkflowRatesPreserved: plan.existingLinkflowRates,
      migrationHash,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  console.error(JSON.stringify({
    applied: commitAttempted ? "unconfirmed" : false,
    error: /^[0-9A-Z]{5}$/.test(error?.code ?? "") || /^LINKFLOW_/.test(error?.code ?? "")
      ? error.code
      : "LINKFLOW_PRICING_MIGRATION_FAILED",
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
