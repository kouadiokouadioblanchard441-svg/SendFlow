import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const migrationId = "linkflow-payment-attempts";
const migrationSql = readFileSync(
  new URL("../../../lib/db/migrations/2026-10-25-linkflow-payment-attempts.sql", import.meta.url),
  "utf8",
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
export const checksum = digest(migrationSql);
const tableName = "sf_customer_payment_link_payments";
const prerequisites = [
  "sf_payment_schema_versions",
  "sf_customer_payment_links",
  "sf_payment_intents",
  "sf_payment_attempts",
  "sf_payment_confirmations",
  "sf_wallets",
  "sf_transactions",
  "sf_wallet_ledger",
];

export class LinkFlowPaymentMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "LinkFlowPaymentMigrationError";
    this.code = code;
  }
}

export async function linkFlowPaymentAssociationCatalog(client) {
  const relations = (await client.query(`
    SELECT c.relname,
      EXISTS (
        SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        WHERE a.grantee = 0
      ) AS public_access,
      (SELECT jsonb_agg(
        jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull,
          pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum
      )
       FROM pg_attribute a
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
       (SELECT jsonb_agg(jsonb_build_array(k.conname, pg_get_constraintdef(k.oid)) ORDER BY k.conname)
        FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype <> 'n') AS constraints,
      (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid))
       FROM pg_index i WHERE i.indrelid = c.oid) AS indexes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = $1
  `, [tableName])).rows;
  const triggers = (await client.query(`
    SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = $1 AND NOT t.tgisinternal
    ORDER BY t.tgname
  `, [tableName])).rows;
  return { relations, triggers };
}

export async function planLinkFlowPaymentAssociation(client) {
  const existingPrerequisites = (await client.query(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [prerequisites])).rows.map((row) => row.relname);
  const missingPrerequisites = prerequisites.filter((name) => !existingPrerequisites.includes(name));
  const historyGuard = (await client.query(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sf_payments_reject_history_mutation'
  `)).rows.length > 0;
  const catalog = await linkFlowPaymentAssociationCatalog(client);
  const tablePresent = catalog.relations.length === 1;
  const registryPresent = existingPrerequisites.includes("sf_payment_schema_versions");
  const record = registryPresent
    ? (await client.query(`
        SELECT checksum, schema_fingerprint
        FROM public.sf_payment_schema_versions
        WHERE migration_id = $1
      `, [migrationId])).rows[0]
    : undefined;
  const conflicts = [];

  if (missingPrerequisites.length) conflicts.push("PAYMENT_EXECUTION_PREREQUISITES_MISSING");
  if (!historyGuard) conflicts.push("PAYMENT_HISTORY_GUARD_MISSING");
  if (record) {
    if (!tablePresent || record.checksum !== checksum ||
      record.schema_fingerprint !== digest(JSON.stringify(catalog))) {
      conflicts.push("LINKFLOW_PAYMENT_SCHEMA_DRIFT");
    }
  } else if (tablePresent || catalog.triggers.length) {
    conflicts.push("UNTRACKED_LINKFLOW_PAYMENT_SCHEMA_OBJECT");
  }

  return {
    migrationId,
    checksum,
    fingerprint: digest(JSON.stringify({ checksum, catalog, missingPrerequisites, historyGuard })),
    alreadyApplied: Boolean(record) && conflicts.length === 0,
    conflicts,
    prerequisites,
    missingPrerequisites,
    newBusinessTables: record ? 0 : 1,
    existingRowsWillBeRewritten: false,
    providerCallsEnabled: false,
    paymentsEnabled: false,
  };
}

export async function applyLinkFlowPaymentAssociation(client, expectedFingerprint) {
  let committing = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
      [migrationId],
    );
    if (!lock.rows[0].acquired) throw new LinkFlowPaymentMigrationError("LINKFLOW_PAYMENT_MIGRATION_BUSY");
    const plan = await planLinkFlowPaymentAssociation(client);
    if (plan.fingerprint !== expectedFingerprint) {
      throw new LinkFlowPaymentMigrationError("STALE_LINKFLOW_PAYMENT_MIGRATION_PLAN");
    }
    if (plan.conflicts.length) throw new LinkFlowPaymentMigrationError(plan.conflicts[0]);
    if (plan.alreadyApplied) {
      await client.query("ROLLBACK");
      return { applied: false, alreadyApplied: true };
    }

    await client.query(migrationSql);
    const catalog = await linkFlowPaymentAssociationCatalog(client);
    const relation = catalog.relations[0];
    if (!relation || relation.columns?.length !== 11 ||
      relation.constraints?.length !== 12 || relation.indexes?.length !== 5 ||
      relation.public_access !== false || catalog.triggers.length !== 1) {
      throw new LinkFlowPaymentMigrationError("LINKFLOW_PAYMENT_SCHEMA_INCOMPLETE_OR_PUBLIC");
    }
    await client.query(`
      INSERT INTO public.sf_payment_schema_versions(migration_id, checksum, schema_fingerprint)
      VALUES ($1, $2, $3)
    `, [migrationId, checksum, digest(JSON.stringify(catalog))]);

    committing = true;
    await client.query("COMMIT");
    return {
      applied: true,
      newBusinessTables: 1,
      existingRowsWillBeRewritten: false,
      providerCallsEnabled: false,
      paymentsEnabled: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (committing) throw new LinkFlowPaymentMigrationError("LINKFLOW_PAYMENT_MIGRATION_OUTCOME_UNKNOWN");
    throw error;
  }
}
