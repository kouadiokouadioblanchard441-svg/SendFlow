import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const migrationId = "linkflow-otp-confirmed-at";
const migrationSql = readFileSync(join(root, "lib/db/migrations/2026-11-09-linkflow-otp-confirmed-at.sql"), "utf8");
const checksum = createHash("sha256").update(migrationSql).digest("hex");
const postState = {
  relation: "public.sf_payment_attempts",
  column: "otp_confirmed_at",
  dataType: "timestamp with time zone",
  isNullable: "YES",
  columnDefault: null,
};
const postFingerprint = createHash("sha256").update(JSON.stringify(postState)).digest("hex");

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readCurrentState(client) {
  const [relationResult, columnResult, registryResult] = await Promise.all([
    client.query("SELECT to_regclass('public.sf_payment_attempts') AS payment_attempts, to_regclass('public.sf_payment_schema_versions') AS schema_versions"),
    client.query(`SELECT data_type AS "dataType", is_nullable AS "isNullable", column_default AS "columnDefault"
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sf_payment_attempts' AND column_name='otp_confirmed_at'`),
    client.query(`SELECT checksum, schema_fingerprint AS "schemaFingerprint"
      FROM public.sf_payment_schema_versions WHERE migration_id=$1`, [migrationId]),
  ]);
  return {
    paymentAttemptsExists: Boolean(relationResult.rows[0]?.payment_attempts),
    schemaVersionsExists: Boolean(relationResult.rows[0]?.schema_versions),
    column: columnResult.rows[0] ?? null,
    registry: registryResult.rows[0] ?? null,
  };
}

export async function planLinkFlowOtpColumn(client) {
  const current = await readCurrentState(client);
  const missingPrerequisites = [];
  const conflicts = [];
  if (!current.paymentAttemptsExists) missingPrerequisites.push("sf_payment_attempts");
  if (!current.schemaVersionsExists) missingPrerequisites.push("sf_payment_schema_versions");

  const columnIsExact = current.column?.dataType === postState.dataType
    && current.column?.isNullable === postState.isNullable
    && current.column?.columnDefault === postState.columnDefault;
  const alreadyApplied = current.registry?.checksum === checksum
    && current.registry?.schemaFingerprint === postFingerprint
    && columnIsExact;

  if (current.registry && current.registry.checksum !== checksum) {
    conflicts.push("A different checksum is registered for this migration");
  }
  if (current.registry && !columnIsExact) {
    conflicts.push("The registered OTP confirmation column is missing or has drifted");
  }
  if (current.registry && current.registry.schemaFingerprint !== postFingerprint) {
    conflicts.push("The recorded OTP confirmation schema fingerprint does not match");
  }
  if (!current.registry && current.column) {
    conflicts.push("An unregistered otp_confirmed_at column already exists");
  }

  const fingerprint = hash({
    target: process.env.SENDFLOW_DATABASE_TARGET ?? null,
    migrationId,
    checksum,
    current,
  });
  return {
    migrationId,
    checksum,
    fingerprint,
    alreadyApplied,
    missingPrerequisites,
    conflicts,
    currentColumn: current.column,
    rowsWillBeRewritten: false,
    paymentsWillBeActivated: false,
  };
}

export async function applyLinkFlowOtpColumn(client, expectedFingerprint) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [migrationId]);
    const plan = await planLinkFlowOtpColumn(client);
    if (plan.fingerprint !== expectedFingerprint || plan.conflicts.length || plan.missingPrerequisites.length) {
      const error = new Error("The OTP column migration plan changed or contains conflicts");
      error.code = "LINKFLOW_OTP_COLUMN_PLAN_CHANGED";
      throw error;
    }
    if (plan.alreadyApplied) {
      await client.query("COMMIT");
      return { applied: false, alreadyApplied: true };
    }

    await client.query(migrationSql);
    const after = await readCurrentState(client);
    const columnIsExact = after.column?.dataType === postState.dataType
      && after.column?.isNullable === postState.isNullable
      && after.column?.columnDefault === postState.columnDefault;
    if (!columnIsExact || after.registry) {
      const error = new Error("The OTP confirmation column postcondition failed");
      error.code = "LINKFLOW_OTP_COLUMN_POSTCONDITION_FAILED";
      throw error;
    }
    await client.query(
      `INSERT INTO public.sf_payment_schema_versions(migration_id, checksum, schema_fingerprint)
       VALUES ($1, $2, $3)`,
      [migrationId, checksum, postFingerprint],
    );
    await client.query("COMMIT");
    return { applied: true, alreadyApplied: false, schemaFingerprint: postFingerprint };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}
