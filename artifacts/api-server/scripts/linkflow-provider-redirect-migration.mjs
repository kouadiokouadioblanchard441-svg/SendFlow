import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const migrationId = "linkflow-provider-redirect";
const migrationSql = readFileSync(
  join(root, "lib/db/migrations/2026-11-09-linkflow-provider-redirect.sql"),
  "utf8",
);
const checksum = createHash("sha256").update(migrationSql).digest("hex");
const relation = "public.sf_customer_payment_link_payments";
const column = "provider_redirect_url_encrypted";
const constraint = "sf_customer_link_provider_redirect_cipher_check";

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readCurrentState(client) {
  const [relationResult, columnResult, constraintResult, registryResult] = await Promise.all([
    client.query(
      "SELECT to_regclass($1) AS payment_link_payments, to_regclass('public.sf_payment_schema_versions') AS schema_versions",
      [relation],
    ),
    client.query(
      `SELECT data_type AS "dataType", is_nullable AS "isNullable", column_default AS "columnDefault"
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='sf_customer_payment_link_payments'
         AND column_name='provider_redirect_url_encrypted'`,
    ),
    client.query(
      `SELECT contype AS "type", convalidated AS validated,
          pg_get_constraintdef(oid, true) AS definition
       FROM pg_constraint
       WHERE conrelid=to_regclass($1) AND conname=$2`,
      [relation, constraint],
    ),
    client.query(
      `SELECT checksum, schema_fingerprint AS "schemaFingerprint"
       FROM public.sf_payment_schema_versions WHERE migration_id=$1`,
      [migrationId],
    ),
  ]);
  return {
    paymentLinkPaymentsExists: Boolean(relationResult.rows[0]?.payment_link_payments),
    schemaVersionsExists: Boolean(relationResult.rows[0]?.schema_versions),
    column: columnResult.rows[0] ?? null,
    constraint: constraintResult.rows[0] ?? null,
    registry: registryResult.rows[0] ?? null,
  };
}

function isExpectedColumn(value) {
  return value?.dataType === "text" && value?.isNullable === "YES" &&
    value?.columnDefault === null;
}

function isExpectedConstraint(value) {
  const definition = typeof value?.definition === "string" ? value.definition.toLowerCase() : "";
  return value?.type === "c" && value?.validated === true &&
    definition.includes("provider_redirect_url_encrypted is null") &&
    definition.includes("sfenc-v1") &&
    definition.includes("octet_length(provider_redirect_url_encrypted)") &&
    definition.includes("4096");
}

function postState() {
  return {
    relation,
    column,
    dataType: "text",
    isNullable: "YES",
    columnDefault: null,
    constraint,
    constraintType: "c",
    validated: true,
    validation: "encrypted URL format and maximum 4096 bytes",
  };
}

export async function planLinkFlowProviderRedirectMigration(client) {
  const current = await readCurrentState(client);
  const missingPrerequisites = [];
  const conflicts = [];
  if (!current.paymentLinkPaymentsExists) missingPrerequisites.push("sf_customer_payment_link_payments");
  if (!current.schemaVersionsExists) missingPrerequisites.push("sf_payment_schema_versions");
  const hasColumn = isExpectedColumn(current.column);
  const hasConstraint = isExpectedConstraint(current.constraint);
  const alreadyApplied = current.registry?.checksum === checksum
    && current.registry?.schemaFingerprint === hash(postState())
    && hasColumn && hasConstraint;

  if (current.column && !hasColumn) conflicts.push("Provider redirect column exists with an unexpected definition");
  if (current.constraint && !hasConstraint) conflicts.push("Provider redirect constraint exists with an unexpected definition");
  if (current.registry && current.registry.checksum !== checksum) conflicts.push("A different checksum is registered");
  if (current.registry && current.registry.schemaFingerprint !== hash(postState())) {
    conflicts.push("The registered provider redirect schema fingerprint does not match");
  }
  if (!current.registry && (current.column || current.constraint)) {
    conflicts.push("An unregistered provider redirect schema object already exists");
  }

  return {
    migrationId,
    checksum,
    fingerprint: hash({
      target: process.env.SENDFLOW_DATABASE_TARGET ?? null,
      migrationId,
      checksum,
      current,
    }),
    alreadyApplied,
    missingPrerequisites,
    conflicts,
    currentColumn: current.column,
    currentConstraint: current.constraint,
    rowsWillBeRewritten: false,
    paymentRoutesWillBeActivated: false,
  };
}

export async function applyLinkFlowProviderRedirectMigration(client, expectedFingerprint) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [migrationId]);
    const plan = await planLinkFlowProviderRedirectMigration(client);
    if (plan.fingerprint !== expectedFingerprint ||
      plan.conflicts.length || plan.missingPrerequisites.length) {
      const error = new Error("The provider redirect migration plan changed or contains conflicts");
      error.code = "LINKFLOW_PROVIDER_REDIRECT_PLAN_CHANGED";
      throw error;
    }
    if (plan.alreadyApplied) {
      await client.query("COMMIT");
      return { applied: false, alreadyApplied: true };
    }

    await client.query(migrationSql);
    const after = await readCurrentState(client);
    if (!isExpectedColumn(after.column) || !isExpectedConstraint(after.constraint) || after.registry) {
      const error = new Error("The provider redirect migration postcondition failed");
      error.code = "LINKFLOW_PROVIDER_REDIRECT_POSTCONDITION_FAILED";
      throw error;
    }
    const fingerprint = hash(postState());
    await client.query(
      `INSERT INTO public.sf_payment_schema_versions(migration_id, checksum, schema_fingerprint)
       VALUES ($1, $2, $3)`,
      [migrationId, checksum, fingerprint],
    );
    await client.query("COMMIT");
    return { applied: true, alreadyApplied: false, schemaFingerprint: fingerprint };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
