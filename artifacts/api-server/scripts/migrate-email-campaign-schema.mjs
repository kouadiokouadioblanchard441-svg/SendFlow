import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const tables = [
  "sf_customer_service_settings",
  "sf_email_campaign_attempts",
  "sf_email_campaign_provider_events",
  "sf_email_campaign_recipients",
  "sf_email_campaign_retry_requests",
  "sf_email_campaigns",
  "sf_email_marketing_preference_events",
  "sf_email_marketing_suppressions",
].sort();

const expectedColumns = {
  sf_customer_service_settings: ["id", "phone_number", "whatsapp_number", "facebook_label", "facebook_url", "version", "updated_by", "updated_at"],
  sf_email_campaign_attempts: ["id", "recipient_id", "attempt_number", "status", "idempotency_key", "email_snapshot_encrypted", "email_snapshot_lookup_hash", "provider_message_id", "provider_updated_at", "error_class", "http_status", "started_at", "finished_at", "created_at", "updated_at"],
  sf_email_campaign_provider_events: ["provider_event_id", "recipient_id", "attempt_id", "provider_message_id", "event_type", "occurred_at", "received_at", "processed_at"],
  sf_email_campaign_recipients: ["id", "campaign_id", "user_id", "status", "attempts", "manual_retries", "email_snapshot_encrypted", "email_snapshot_lookup_hash", "provider_message_id", "provider_updated_at", "last_error_class", "last_error_status", "next_attempt_at", "processing_started_at", "accepted_at", "created_at", "updated_at"],
  sf_email_campaign_retry_requests: ["idempotency_key", "recipient_id", "admin_user_id", "created_at"],
  sf_email_campaigns: ["id", "subject", "body_text", "audience_mode", "status", "recipient_count", "unverified_recipient_count", "created_by", "created_at", "updated_at", "queued_at", "completed_at"],
  sf_email_marketing_preference_events: ["id", "user_id", "action", "source", "created_at"],
  sf_email_marketing_suppressions: ["email_lookup_hash", "reason", "provider_event_id", "created_at", "updated_at"],
};

const expectedIndexes = [
  "sf_customer_service_settings_pkey",
  "sf_email_campaign_attempt_idempotency_idx",
  "sf_email_campaign_attempt_recipient_created_idx",
  "sf_email_campaign_attempt_recipient_number_uq",
  "sf_email_campaign_attempts_pkey",
  "sf_email_campaign_created_idx",
  "sf_email_campaign_provider_event_attempt_idx",
  "sf_email_campaign_provider_event_recipient_idx",
  "sf_email_campaign_provider_events_pkey",
  "sf_email_campaign_recipient_campaign_status_idx",
  "sf_email_campaign_recipient_queue_idx",
  "sf_email_campaign_recipient_uq",
  "sf_email_campaign_recipients_pkey",
  "sf_email_campaign_retry_recipient_created_idx",
  "sf_email_campaign_retry_requests_pkey",
  "sf_email_campaign_status_idx",
  "sf_email_campaigns_pkey",
  "sf_email_marketing_preference_user_created_idx",
  "sf_email_marketing_preference_events_pkey",
  "sf_email_marketing_suppression_reason_idx",
  "sf_email_marketing_suppressions_pkey",
].sort();

const expectedConstraints = [
  "sf_customer_service_settings_facebook_pair_check",
  "sf_customer_service_settings_phone_check",
  "sf_customer_service_settings_pkey",
  "sf_customer_service_settings_singleton_check",
  "sf_customer_service_settings_version_check",
  "sf_customer_service_settings_whatsapp_check",
  "sf_email_campaign_attempt_number_check",
  "sf_email_campaign_attempt_status_check",
  "sf_email_campaign_attempts_pkey",
  "sf_email_campaign_attempts_recipient_id_fkey",
  "sf_email_campaign_provider_event_type_check",
  "sf_email_campaign_provider_events_attempt_id_fkey",
  "sf_email_campaign_provider_events_pkey",
  "sf_email_campaign_provider_events_recipient_id_fkey",
  "sf_email_campaign_recipient_attempts_check",
  "sf_email_campaign_recipient_manual_retries_check",
  "sf_email_campaign_recipient_status_check",
  "sf_email_campaign_recipients_campaign_id_fkey",
  "sf_email_campaign_recipients_pkey",
  "sf_email_campaign_recipients_user_id_fkey",
  "sf_email_campaign_retry_requests_admin_user_id_fkey",
  "sf_email_campaign_retry_requests_pkey",
  "sf_email_campaign_retry_requests_recipient_id_fkey",
  "sf_email_campaigns_created_by_fkey",
  "sf_email_campaigns_pkey",
  "sf_email_campaign_audience_check",
  "sf_email_campaign_status_check",
  "sf_email_campaign_subject_nonblank",
  "sf_email_marketing_preference_events_pkey",
  "sf_email_marketing_preference_events_user_id_fkey",
  "sf_email_marketing_suppression_reason_check",
  "sf_email_marketing_suppressions_pkey",
].sort();

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const planOnly = args.includes("--plan");
const expectedHash = args.find((arg) => arg.startsWith("--expected-hash="))
  ?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--plan", "--verify", "--apply", "--confirm-shared-database"]);

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || process.env.SENDFLOW_REPLIT_LIVE_APPROVED === "true"
  || !process.env.REPL_ID
  || !process.env.DATABASE_CA_CERT?.trim()
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || [apply, verifyOnly, planOnly].filter(Boolean).length !== 1
  || (apply && (!args.includes("--confirm-shared-database") || !expectedHash))
  || (!apply && (args.includes("--confirm-shared-database") || expectedHash))
) {
  console.error("Stopped: requires the shared development database, verified TLS, shared-database approval, and a reviewed plan fingerprint for writes.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-01-email-campaign-and-service-settings.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const connectionUrl = new URL(resolveRuntimeDatabaseUrl(process.env));
if (connectionUrl.searchParams.get("sslmode") !== "verify-full") {
  console.error("Stopped: the shared database requires verified TLS.");
  process.exit(1);
}
connectionUrl.searchParams.delete("sslmode");
connectionUrl.searchParams.delete("ssl");
connectionUrl.searchParams.delete("uselibpqcompat");

const client = new pg.Client({
  connectionString: connectionUrl.toString(),
  ssl: {
    ca: process.env.DATABASE_CA_CERT.trim(),
    rejectUnauthorized: true,
    servername: connectionUrl.hostname,
  },
  application_name: "sendflow_email_campaign_schema_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

async function inspectSchema() {
  const [tableResult, columnResult, indexResult, constraintResult, userIdResult] = await Promise.all([
    client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = ANY($1::text[]) ORDER BY table_name",
      [tables],
    ),
    client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY table_name, ordinal_position",
      [tables],
    ),
    client.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY indexname",
      [tables],
    ),
    client.query(
      "SELECT c.conname FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND r.relname = ANY($1::text[]) ORDER BY c.conname",
      [tables],
    ),
    client.query(
      "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sf_users' AND column_name = 'id'",
    ),
  ]);
  const existingTables = tableResult.rows.map((row) => row.table_name);
  const existingColumns = Object.fromEntries(tables.map((name) => [
    name,
    columnResult.rows.filter((row) => row.table_name === name).map((row) => row.column_name),
  ]));
  const existingIndexes = indexResult.rows.map((row) => row.indexname);
  const existingConstraints = constraintResult.rows.map((row) => row.conname);
  const missingTables = tables.filter((name) => !existingTables.includes(name));
  const columnsMatch = tables.every((name) =>
    JSON.stringify(existingColumns[name]) === JSON.stringify(expectedColumns[name]));
  const indexesMatch = JSON.stringify(existingIndexes) === JSON.stringify(expectedIndexes);
  const constraintsMatch = JSON.stringify(existingConstraints) === JSON.stringify(expectedConstraints);
  const singletonResult = existingTables.includes("sf_customer_service_settings")
    ? await client.query(
      "SELECT EXISTS (SELECT 1 FROM public.sf_customer_service_settings WHERE id = 'global') AS present",
    )
    : { rows: [{ present: false }] };
  const globalSettingsRowPresent = singletonResult.rows[0]?.present === true;
  const usersIdType = userIdResult.rows[0]?.data_type ?? null;
  const alreadyApplied = missingTables.length === 0
    && columnsMatch
    && indexesMatch
    && constraintsMatch
    && globalSettingsRowPresent
    && usersIdType === "text";
  const safeToApply = existingTables.length === 0 && usersIdType === "text";
  const fingerprint = createHash("sha256").update(JSON.stringify({
    target: "shared-external-development",
    migrationHash,
    existingTables,
    existingColumns,
    existingIndexes,
    existingConstraints,
    globalSettingsRowPresent,
    usersIdType,
  })).digest("hex");
  return {
    alreadyApplied,
    safeToApply,
    columnsMatch,
    indexesMatch,
    constraintsMatch,
    globalSettingsRowPresent,
    usersIdType,
    existingTables,
    missingTables,
    fingerprint,
  };
}

try {
  await client.connect();
  const { rows: recoveryRows } = await client.query("SELECT pg_is_in_recovery() AS read_replica");
  if (recoveryRows[0]?.read_replica) throw new Error("READ_ONLY_REPLICA");

  if (apply) {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "sendflow_email_campaign_schema_migration_v1",
    ]);
    const before = await inspectSchema();
    if (before.alreadyApplied) {
      await client.query("ROLLBACK");
      console.log(JSON.stringify({ target: "shared-external-development", alreadyApplied: true }));
    } else if (!before.safeToApply || before.fingerprint !== expectedHash) {
      throw new Error("SCHEMA_STATE_CHANGED_OR_PARTIAL");
    } else {
      await client.query(migrationSql);
      const after = await inspectSchema();
      if (!after.alreadyApplied) throw new Error("POST_MIGRATION_VERIFICATION_FAILED");
      await client.query("COMMIT");
      console.log(JSON.stringify({
        target: "shared-external-development",
        applied: true,
        createdTables: tables,
        indexesVerified: after.indexesMatch,
        constraintsVerified: after.constraintsMatch,
        globalSettingsRowPresent: after.globalSettingsRowPresent,
      }));
    }
  } else {
    await client.query("BEGIN READ ONLY");
    const snapshot = await inspectSchema();
    await client.query("COMMIT");
    if (verifyOnly) {
      console.log(JSON.stringify({
        target: "shared-external-development",
        verified: snapshot.alreadyApplied,
        missingTables: snapshot.missingTables,
        columnsMatch: snapshot.columnsMatch,
        indexesMatch: snapshot.indexesMatch,
        constraintsMatch: snapshot.constraintsMatch,
        globalSettingsRowPresent: snapshot.globalSettingsRowPresent,
      }));
      if (!snapshot.alreadyApplied) process.exitCode = 1;
    } else {
      console.log(JSON.stringify({
        target: "shared-external-development",
        migrationHash,
        expectedHash: snapshot.fingerprint,
        safeToApply: snapshot.safeToApply,
        alreadyApplied: snapshot.alreadyApplied,
        missingTables: snapshot.missingTables,
        usersTableReady: snapshot.usersIdType === "text",
      }));
    }
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  const code = error instanceof Error ? error.message : "UNKNOWN";
  console.error(JSON.stringify({ applied: false, error: code }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
