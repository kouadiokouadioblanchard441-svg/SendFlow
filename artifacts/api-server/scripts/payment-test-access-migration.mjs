import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { planPaymentStructures } from "./payment-structures-migration.mjs";

export const migrationId = "replit-payment-test-access";
const migrationSql = readFileSync(
  new URL("../../../lib/db/migrations/2026-10-22-replit-payment-test-access.sql", import.meta.url),
  "utf8",
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const checksum = digest(migrationSql);
const protectedTables = [
  "sf_users", "sf_wallets", "sf_transactions", "sf_wallet_ledger", "sf_countries",
  "sf_operator_catalog", "sf_operator_pricing_rates", "sf_payment_aggregators",
  "sf_operation_aggregator_routes",
];

export class PaymentTestAccessMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "PaymentTestAccessMigrationError";
    this.code = code;
  }
}

export async function paymentTestAccessCatalog(client) {
  const relations = (await client.query(`SELECT c.relname,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee=0) AS public_access,
    (SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),
      a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_array(k.conname,pg_get_constraintdef(k.oid)) ORDER BY k.conname)
     FROM pg_constraint k WHERE k.conrelid=c.oid) AS constraints,
    (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid))
     FROM pg_index i WHERE i.indrelid=c.oid) AS indexes
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='sf_replit_payment_test_access'`)).rows;
  const routines = (await client.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0) AS public_access
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='sf_guard_replit_payment_test_access'`)).rows;
  const triggers = (await client.query(`SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='sf_replit_payment_test_access' AND NOT t.tgisinternal
    ORDER BY t.tgname`)).rows;
  return { relations, routines, triggers };
}

export async function planPaymentTestAccess(client) {
  const base = await planPaymentStructures(client);
  if (!base.alreadyApplied || base.conflicts.length) {
    throw new PaymentTestAccessMigrationError("PAYMENT_EXECUTION_SCHEMA_NOT_VERIFIED");
  }
  const catalog = await paymentTestAccessCatalog(client);
  const registry = await client.query(`SELECT checksum,schema_fingerprint
    FROM public.sf_payment_schema_versions WHERE migration_id=$1`, [migrationId]);
  const record = registry.rows[0];
  const conflicts = [];
  if (record) {
    if (record.checksum !== checksum ||
      record.schema_fingerprint !== digest(JSON.stringify(catalog)) ||
      catalog.relations.length !== 1 || catalog.routines.length !== 1 || catalog.triggers.length !== 3) {
      conflicts.push("EXISTING_PAYMENT_TEST_ACCESS_SCHEMA_DRIFT");
    }
  } else if (catalog.relations.length || catalog.routines.length || catalog.triggers.length) {
    conflicts.push("UNTRACKED_PAYMENT_TEST_ACCESS_SCHEMA_OBJECTS");
  }
  return {
    migrationId,
    checksum,
    fingerprint: digest(JSON.stringify({ checksum, catalog, base: base.checksum })),
    alreadyApplied: Boolean(record) && conflicts.length === 0,
    conflicts,
    newBusinessTables: record ? 0 : 1,
    newActiveTestAccounts: 0,
    existingRowsWillBeRewritten: false,
    paymentsWillBeActivated: false,
  };
}

async function protectedSnapshot(client) {
  const snapshot = {};
  let total = 0;
  for (const table of protectedTables) {
    const count = Number((await client.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);
    total += count;
    if (total > 100_000) throw new PaymentTestAccessMigrationError("PROTECTED_SNAPSHOT_REQUIRES_REVIEW");
    snapshot[table] = (await client.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(row_hash,'' ORDER BY row_hash),'')) AS digest
      FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public.${table} t) rows`)).rows[0];
  }
  return snapshot;
}

export async function applyPaymentTestAccess(client, expectedFingerprint) {
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired",
      [migrationId],
    );
    if (!lock.rows[0].acquired) throw new PaymentTestAccessMigrationError("PAYMENT_TEST_ACCESS_MIGRATION_BUSY");
    const plan = await planPaymentTestAccess(client);
    if (plan.fingerprint !== expectedFingerprint) throw new PaymentTestAccessMigrationError("STALE_PAYMENT_TEST_ACCESS_PLAN");
    if (plan.conflicts.length) throw new PaymentTestAccessMigrationError(plan.conflicts[0]);
    if (plan.alreadyApplied) {
      await client.query("ROLLBACK");
      return { applied: false, alreadyApplied: true };
    }
    const before = await protectedSnapshot(client);
    await client.query(migrationSql);
    const catalog = await paymentTestAccessCatalog(client);
    if (catalog.relations.length !== 1 || catalog.routines.length !== 1 || catalog.triggers.length !== 3) {
      throw new PaymentTestAccessMigrationError("PAYMENT_TEST_ACCESS_SCHEMA_INCOMPLETE");
    }
    await client.query(`INSERT INTO public.sf_payment_schema_versions(migration_id,checksum,schema_fingerprint)
      VALUES($1,$2,$3)`, [migrationId, checksum, digest(JSON.stringify(catalog))]);
    const after = await protectedSnapshot(client);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new PaymentTestAccessMigrationError("PROTECTED_FINANCIAL_ROWS_CHANGED");
    }
    const verified = await planPaymentTestAccess(client);
    if (!verified.alreadyApplied || verified.conflicts.length) {
      throw new PaymentTestAccessMigrationError("PAYMENT_TEST_ACCESS_SCHEMA_VERIFICATION_FAILED");
    }
    await client.query("COMMIT");
    return { applied: true, alreadyApplied: false, newActiveTestAccounts: 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
