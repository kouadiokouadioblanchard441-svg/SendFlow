import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const migrationId = "payment-execution-structures";
const sql = readFileSync(new URL("../../../lib/db/migrations/2026-10-22-payment-execution-structures.sql", import.meta.url), "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");
export const checksum = digest(sql);
const tables = [
  "sf_payment_intents", "sf_payment_attempts", "sf_payment_confirmations",
  "sf_wallet_payment_reservations", "sf_payment_schema_versions",
];
const functions = [
  "sf_payments_reject_history_mutation", "sf_payments_guard_intent",
  "sf_payments_guard_attempt", "sf_payments_guard_confirmation",
  "sf_payments_guard_reservation", "sf_payments_wallet_floor", "sf_payments_transaction_snapshot",
];
const protectedTables = [
  "sf_users", "sf_wallets", "sf_transactions", "sf_wallet_ledger", "sf_countries",
  "sf_operator_catalog", "sf_operator_pricing_rates", "sf_payment_aggregators",
  "sf_operation_aggregator_routes",
];

export class PaymentMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "PaymentMigrationError";
    this.code = code;
  }
}

export async function paymentStructureCatalog(client) {
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
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`, [tables])).rows;
  const routines = (await client.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition,
    EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0) AS public_access
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) ORDER BY p.proname`, [functions])).rows;
  const triggers = (await client.query(`SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND (c.relname=ANY($1::text[])
      OR t.tgname IN ('sf_payment_wallet_reserved_floor','sf_payment_transaction_snapshot_guard'))
    ORDER BY c.relname,t.tgname`, [tables])).rows;
  return { relations, routines, triggers };
}

export async function planPaymentStructures(client) {
  const catalog = await paymentStructureCatalog(client);
  const present = catalog.relations.some((r) => r.relname === "sf_payment_schema_versions");
  const record = present ? (await client.query(`SELECT checksum,schema_fingerprint
    FROM public.sf_payment_schema_versions WHERE migration_id=$1`, [migrationId])).rows[0] : undefined;
  const conflicts = [];
  if (record) {
    if (record.checksum !== checksum || record.schema_fingerprint !== digest(JSON.stringify(catalog))) {
      conflicts.push("EXISTING_PAYMENT_SCHEMA_DRIFT");
    }
  } else if (catalog.relations.length || catalog.routines.length || catalog.triggers.length) {
    conflicts.push("UNTRACKED_PAYMENT_SCHEMA_OBJECTS");
  }
  return {
    migrationId, checksum, fingerprint: digest(JSON.stringify({ checksum, catalog })),
    alreadyApplied: !!record && conflicts.length === 0, conflicts,
    newBusinessTables: record ? 0 : 4, newMigrationRegistry: record ? 0 : 1,
    existingRowsWillBeRewritten: false, paymentsWillBeActivated: false,
  };
}

async function protectedSnapshot(client) {
  const snapshot = {};
  let total = 0;
  for (const table of protectedTables) {
    // All identifiers come from the fixed private allowlist above.
    const count = Number((await client.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);
    total += count;
    if (total > 100_000) throw new PaymentMigrationError("PROTECTED_SNAPSHOT_REQUIRES_MAINTENANCE_REVIEW");
    snapshot[table] = (await client.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(row_hash,'' ORDER BY row_hash),'')) AS digest
      FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public.${table} t) rows`)).rows[0];
  }
  return snapshot;
}

export async function applyPaymentStructures(client, expectedFingerprint) {
  let committing = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s'");
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired", [migrationId]);
    if (!lock.rows[0].acquired) throw new PaymentMigrationError("PAYMENT_MIGRATION_BUSY");
    const plan = await planPaymentStructures(client);
    if (plan.fingerprint !== expectedFingerprint) throw new PaymentMigrationError("STALE_PAYMENT_MIGRATION_PLAN");
    if (plan.conflicts.length) throw new PaymentMigrationError(plan.conflicts[0]);
    if (plan.alreadyApplied) {
      await client.query("ROLLBACK");
      return { applied: false, alreadyApplied: true };
    }
    const before = await protectedSnapshot(client);
    await client.query(sql);
    const catalog = await paymentStructureCatalog(client);
    if (catalog.relations.length !== 5 || catalog.routines.length !== functions.length) {
      throw new PaymentMigrationError("PAYMENT_SCHEMA_INCOMPLETE");
    }
    const after = await protectedSnapshot(client);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new PaymentMigrationError("EXISTING_ROWS_CHANGED");
    await client.query(`INSERT INTO public.sf_payment_schema_versions
      (migration_id,checksum,schema_fingerprint) VALUES($1,$2,$3)`,
    [migrationId, checksum, digest(JSON.stringify(catalog))]);
    committing = true;
    await client.query("COMMIT");
    return { applied: true, newBusinessTables: 4, migrationRegistry: 1,
      protectedExistingTablesUnchanged: protectedTables.length, paymentsActivated: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (committing) throw new PaymentMigrationError("PAYMENT_MIGRATION_OUTCOME_UNKNOWN");
    throw error;
  }
}
