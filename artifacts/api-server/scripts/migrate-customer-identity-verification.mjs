import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply");
const verifyOnly = args.includes("--verify");
const planOnly = args.includes("--plan");
const dryRun = args.includes("--dry-run");
const expected = args.find((arg) => arg.startsWith("--expected-hash="))
  ?.slice("--expected-hash=".length);
const allowedArgs = new Set(["--plan", "--dry-run", "--apply", "--verify", "--confirm-shared-database"]);

if (
  process.env.SENDFLOW_DATABASE_TARGET !== "shared-external"
  || process.env.NODE_ENV !== "development"
  || process.env.SENDFLOW_REPLIT_LIVE_APPROVED !== "true"
  || process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true"
  || !process.env.REPL_ID
  || !process.env.DATABASE_CA_CERT?.trim()
  || args.some((arg) => !allowedArgs.has(arg) && !/^--expected-hash=[a-f0-9]{64}$/.test(arg))
  || [apply, verifyOnly, planOnly, dryRun].filter(Boolean).length > 1
  || ((planOnly || dryRun || verifyOnly) && (args.includes("--confirm-shared-database") || expected))
  || (verifyOnly && (args.includes("--confirm-shared-database") || expected))
  || (apply && (!args.includes("--confirm-shared-database") || !expected))
  || (!apply && !verifyOnly && (args.includes("--confirm-shared-database") || expected))
) {
  console.error("Stopped: use a read-only plan, --verify, or an explicitly confirmed, fingerprinted --apply.");
  process.exit(1);
}

const migrationSql = await readFile(
  new URL("../../../lib/db/migrations/2026-11-01-customer-identity-requests.sql", import.meta.url),
  "utf8",
);
const migrationHash = createHash("sha256").update(migrationSql).digest("hex");
const connectionString = resolveRuntimeDatabaseUrl(process.env);
const databaseUrl = new URL(connectionString);
if (databaseUrl.searchParams.get("sslmode") !== "verify-full") {
  console.error("Stopped: the shared database requires verified TLS.");
  process.exit(1);
}
databaseUrl.searchParams.delete("sslmode");
databaseUrl.searchParams.delete("ssl");
databaseUrl.searchParams.delete("uselibpqcompat");

const client = new pg.Client({
  connectionString: databaseUrl.toString(),
  ssl: {
    ca: process.env.DATABASE_CA_CERT.trim(),
    rejectUnauthorized: true,
    servername: databaseUrl.hostname,
  },
  application_name: "sendflow_customer_identity_migration",
  connectionTimeoutMillis: 10_000,
  query_timeout: 30_000,
});

const expectedRequestColumns = [
  "id", "user_id", "idempotency_key", "personal_data_encrypted", "status",
  "decision_reason_encrypted", "submitted_at", "reviewed_at", "reviewed_by", "updated_at",
];
const expectedUploadColumns = [
  "id", "user_id", "request_id", "kind", "object_path", "content_type",
  "expected_size_bytes", "expires_at", "uploaded_at", "created_at",
];
const expectedIndexes = [
  "sf_customer_identity_requests_pkey",
  "sf_customer_identity_requests_user_idempotency_uq",
  "sf_customer_identity_requests_one_pending_uq",
  "sf_customer_identity_requests_user_submitted_idx",
  "sf_customer_identity_uploads_pkey",
  "sf_customer_identity_uploads_object_path_key",
  "sf_customer_identity_uploads_pending_expiry_idx",
  "sf_customer_identity_uploads_request_kind_uq",
];

async function getSnapshot() {
  const result = await client.query(`
    SELECT
      to_regclass('public.sf_users') IS NOT NULL AS users_exists,
      (
        SELECT udt_name = 'text'
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_users'
          AND column_name = 'id'
      ) AS users_id_is_text,
      to_regprocedure('gen_random_uuid()') IS NOT NULL AS uuid_generator_exists,
      to_regclass('public.sf_customer_identity_requests') IS NOT NULL AS requests_exist,
      to_regclass('public.sf_customer_identity_uploads') IS NOT NULL AS uploads_exist,
      coalesce((
        SELECT array_agg(column_name::text ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_customer_identity_requests'
      ), ARRAY[]::text[]) AS request_columns,
      coalesce((
        SELECT array_agg(column_name::text ORDER BY ordinal_position)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sf_customer_identity_uploads'
      ), ARRAY[]::text[]) AS upload_columns,
      coalesce((
        SELECT array_agg(indexname::text ORDER BY indexname)
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
      ), ARRAY[]::text[]) AS identity_indexes
  `, [expectedIndexes]);

  const schema = result.rows[0];
  const requestColumnsMatch = JSON.stringify(schema.request_columns) === JSON.stringify(expectedRequestColumns);
  const uploadColumnsMatch = JSON.stringify(schema.upload_columns) === JSON.stringify(expectedUploadColumns);
  const indexesMatch = JSON.stringify(schema.identity_indexes) === JSON.stringify([...expectedIndexes].sort());
  const alreadyApplied = schema.requests_exist
    && schema.uploads_exist
    && requestColumnsMatch
    && uploadColumnsMatch
    && indexesMatch;
  const noIdentityTablesExist = !schema.requests_exist && !schema.uploads_exist;
  const safeToApply = schema.users_exists
    && schema.users_id_is_text
    && schema.uuid_generator_exists
    && noIdentityTablesExist;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    target: "shared-external",
    migrationHash,
    schema,
  })).digest("hex");

  return {
    safeToApply,
    alreadyApplied,
    schema: {
      users_exists: schema.users_exists,
      users_id_is_text: schema.users_id_is_text,
      uuid_generator_exists: schema.uuid_generator_exists,
      requests_exist: schema.requests_exist,
      uploads_exist: schema.uploads_exist,
      requestColumnsMatch,
      uploadColumnsMatch,
      indexesMatch,
      requestColumns: schema.request_columns,
      uploadColumns: schema.upload_columns,
      identityIndexes: schema.identity_indexes,
    },
    fingerprint,
  };
}

function planSummary(snapshot) {
  return {
    target: "shared-external",
    safeToApply: snapshot.safeToApply,
    alreadyApplied: snapshot.alreadyApplied,
    migrationHash,
    fingerprint: snapshot.fingerprint,
    schema: snapshot.schema,
  };
}

function assertMigrationVerified(snapshot) {
  if (!snapshot.alreadyApplied) {
    throw Object.assign(new Error("Identity migration verification failed."), {
      code: "IDENTITY_MIGRATION_VERIFY_FAILED",
      details: snapshot.schema,
    });
  }
}

let transactionOpen = false;
let commitAttempted = false;
try {
  await client.connect();
  if (verifyOnly) {
    await client.query("BEGIN READ ONLY");
    const snapshot = await getSnapshot();
    assertMigrationVerified(snapshot);
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      target: "shared-external",
      verified: true,
      tables: ["sf_customer_identity_requests", "sf_customer_identity_uploads"],
    }));
  } else if (!apply) {
    if (dryRun) {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SET LOCAL lock_timeout = '2s'");
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('sendflow_customer_identity_migration_v1'))",
      );
      const before = await getSnapshot();
      if (!before.safeToApply) {
        throw Object.assign(new Error("The identity migration preflight is not safe."), {
          code: "IDENTITY_MIGRATION_PLAN_CONFLICT",
          details: before.schema,
        });
      }
      const transactionalSql = migrationSql
        .replace(/^\s*BEGIN\s*;\s*/i, "")
        .replace(/\s*COMMIT\s*;\s*$/i, "");
      await client.query(transactionalSql);
      const after = await getSnapshot();
      assertMigrationVerified(after);
      await client.query("ROLLBACK");
      transactionOpen = false;
      console.log(JSON.stringify({
        target: "shared-external",
        dryRun: true,
        verified: true,
        rolledBack: true,
        tables: ["sf_customer_identity_requests", "sf_customer_identity_uploads"],
      }));
      process.exitCode = 0;
    } else {
      await client.query("BEGIN READ ONLY");
      const plan = planSummary(await getSnapshot());
      await client.query("ROLLBACK");
      console.log(JSON.stringify(plan));
    }
  } else {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('sendflow_customer_identity_migration_v1'))",
    );
    const before = await getSnapshot();
    const plan = planSummary(before);
    if (!plan.safeToApply || plan.fingerprint !== expected) {
      throw Object.assign(new Error("The reviewed identity migration plan is stale or the schema is incompatible."), {
        code: "IDENTITY_MIGRATION_PLAN_CONFLICT",
      });
    }
    const transactionalSql = migrationSql
      .replace(/^\s*BEGIN\s*;\s*/i, "")
      .replace(/\s*COMMIT\s*;\s*$/i, "");
    await client.query(transactionalSql);
    const after = await getSnapshot();
    assertMigrationVerified(after);
    commitAttempted = true;
    await client.query("COMMIT");
    transactionOpen = false;
    console.log(JSON.stringify({
      target: "shared-external",
      applied: true,
      verified: true,
      tables: ["sf_customer_identity_requests", "sf_customer_identity_uploads"],
      migrationHash,
    }));
  }
} catch (error) {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
  const code = /^[0-9A-Z]{5}$/.test(error?.code ?? "")
    || /^IDENTITY_MIGRATION_/.test(error?.code ?? "")
    ? error.code
    : "IDENTITY_MIGRATION_FAILED";
  console.error(JSON.stringify({
    applied: commitAttempted ? "unconfirmed" : false,
    error: code,
    ...(error?.details ? { schema: error.details } : {}),
  }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
