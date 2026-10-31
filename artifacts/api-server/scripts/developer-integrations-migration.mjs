import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const migrationId = "developer-integrations";
const migrationSql = readFileSync(
  new URL("../../../lib/db/migrations/2026-10-27-developer-integrations.sql", import.meta.url),
  "utf8",
);
export const checksum = createHash("sha256").update(migrationSql).digest("hex");
const digest = (value) => createHash("sha256").update(value).digest("hex");

const relationNames = [
  "sf_users",
  "sf_customer_payment_links",
  "sf_developer_api_keys",
  "sf_developer_payment_sessions",
  "sf_developer_webhook_endpoints",
  "sf_developer_webhook_deliveries",
];
const newTables = {
  sf_developer_api_keys: {
    columns: [
      "id", "user_id", "label", "public_key", "public_key_prefix", "public_key_hash",
      "secret_key_prefix", "secret_key_hash", "status", "last_used_at", "revoked_at",
      "created_at", "updated_at",
    ],
    constraints: [
      "sf_developer_api_keys_pkey", "sf_developer_api_keys_public_key_key",
      "sf_developer_api_keys_public_key_hash_key", "sf_developer_api_keys_secret_key_hash_key",
      "sf_developer_api_keys_user_id_fkey",
      "sf_developer_api_keys_status_check", "sf_developer_api_keys_label_check",
      "sf_developer_api_keys_public_prefix_check", "sf_developer_api_keys_public_key_check",
      "sf_developer_api_keys_public_hash_check", "sf_developer_api_keys_secret_prefix_check",
      "sf_developer_api_keys_secret_hash_check", "sf_developer_api_keys_revoke_pair_check",
    ],
    indexes: ["sf_developer_api_keys_owner_created_idx"],
  },
  sf_developer_payment_sessions: {
    columns: [
      "id", "user_id", "api_key_id", "payment_link_id", "idempotency_key",
      "merchant_reference", "request_hash", "client_token_hash", "client_token_encrypted",
      "mode", "amount_minor", "currency", "metadata_encrypted", "expires_at", "created_at",
    ],
    constraints: [
      "sf_developer_payment_sessions_pkey", "sf_developer_payment_sessions_payment_link_id_key",
      "sf_developer_payment_sessions_client_token_hash_key",
      "sf_developer_payment_sessions_owner_idempotency_uq",
      "sf_developer_payment_sessions_owner_reference_uq",
      "sf_developer_payment_sessions_user_id_fkey",
      "sf_developer_payment_sessions_api_key_id_fkey",
      "sf_developer_payment_sessions_payment_link_id_fkey",
      "sf_developer_payment_sessions_request_hash_check",
      "sf_developer_payment_sessions_client_token_hash_check",
      "sf_developer_payment_sessions_client_token_cipher_check",
      "sf_developer_payment_sessions_mode_check", "sf_developer_payment_sessions_amount_check",
      "sf_developer_payment_sessions_currency_check",
      "sf_developer_payment_sessions_idempotency_check",
      "sf_developer_payment_sessions_reference_check",
      "sf_developer_payment_sessions_metadata_cipher_check",
    ],
    indexes: ["sf_developer_payment_sessions_owner_created_idx"],
  },
  sf_developer_webhook_endpoints: {
    columns: [
      "id", "user_id", "label", "url_encrypted", "events", "signing_secret_encrypted",
      "status", "revoked_at", "created_at", "updated_at",
    ],
    constraints: [
      "sf_developer_webhook_endpoints_pkey", "sf_developer_webhook_endpoints_url_cipher_check",
      "sf_developer_webhook_endpoints_user_id_fkey",
      "sf_developer_webhook_endpoints_events_check",
      "sf_developer_webhook_endpoints_secret_cipher_check",
      "sf_developer_webhook_endpoints_status_check",
      "sf_developer_webhook_endpoints_revoke_pair_check",
      "sf_developer_webhook_endpoints_label_check",
    ],
    indexes: ["sf_developer_webhook_endpoints_owner_created_idx"],
  },
  sf_developer_webhook_deliveries: {
    columns: [
      "id", "endpoint_id", "payment_session_id", "event_type", "payload", "status",
      "attempts", "next_attempt_at", "last_attempt_at", "last_http_status",
      "last_error_class", "delivered_at", "created_at", "updated_at",
    ],
    constraints: [
      "sf_developer_webhook_deliveries_pkey",
      "sf_developer_webhook_deliveries_event_uq",
      "sf_developer_webhook_deliveries_endpoint_id_fkey",
      "sf_developer_webhook_deliveries_payment_session_id_fkey",
      "sf_developer_webhook_deliveries_payload_check",
      "sf_developer_webhook_deliveries_event_check",
      "sf_developer_webhook_deliveries_status_check",
      "sf_developer_webhook_deliveries_attempts_check",
    ],
    indexes: ["sf_developer_webhook_deliveries_due_idx"],
  },
};

export class DeveloperIntegrationsMigrationError extends Error {
  constructor(code) {
    super(code);
    this.name = "DeveloperIntegrationsMigrationError";
    this.code = code;
  }
}

async function schemaCatalog(client) {
  const relations = (await client.query(`
    SELECT c.relname,
      EXISTS (
        SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        WHERE a.grantee = 0
      ) AS public_access,
      (SELECT coalesce(jsonb_agg(a.attname ORDER BY a.attnum), '[]'::jsonb)
       FROM pg_attribute a
       WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
      (SELECT coalesce(jsonb_agg(
        jsonb_build_object('name', k.conname, 'definition', pg_get_constraintdef(k.oid),
          'validated', k.convalidated) ORDER BY k.conname
      ), '[]'::jsonb) FROM pg_constraint k
       WHERE k.conrelid = c.oid AND k.contype <> 'n') AS constraints,
      (SELECT coalesce(jsonb_agg(i.relname ORDER BY i.relname), '[]'::jsonb)
       FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
       WHERE x.indrelid = c.oid) AS indexes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [relationNames])).rows;
  const baseColumns = (await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'sf_users' AND column_name = 'id')
        OR (table_name = 'sf_customer_payment_links' AND column_name = 'id'))
    ORDER BY table_name, column_name
  `)).rows;
  return { relations, baseColumns };
}

function schemaProblems(catalog) {
  const problems = [];
  const byName = new Map(catalog.relations.map((relation) => [relation.relname, relation]));
  const links = byName.get("sf_customer_payment_links");
  const sourceColumnExists = links?.columns.includes("source") ?? false;
  const sourceCheck = links?.constraints.find(
    (constraint) => constraint.name === "sf_customer_payment_links_source_check",
  );
  const sourceDefinition = sourceCheck?.definition?.toLowerCase() ?? "";
  if (!sourceColumnExists) problems.push("PAYMENT_LINK_SOURCE_COLUMN_MISSING");
  if (!sourceCheck?.validated || !sourceDefinition.includes("'linkflow'") ||
    !sourceDefinition.includes("'api'")) problems.push("PAYMENT_LINK_SOURCE_CHECK_MISMATCH");

  for (const [tableName, expected] of Object.entries(newTables)) {
    const relation = byName.get(tableName);
    if (!relation) {
      problems.push(`${tableName.toUpperCase()}_MISSING`);
      continue;
    }
    if (relation.public_access) problems.push(`${tableName.toUpperCase()}_PUBLIC_ACCESS`);
    if (JSON.stringify([...relation.columns].sort()) !== JSON.stringify([...expected.columns].sort())) {
      problems.push(`${tableName.toUpperCase()}_COLUMNS_MISMATCH`);
    }
    const constraintNames = relation.constraints.map((constraint) => constraint.name).sort();
    if (JSON.stringify(constraintNames) !== JSON.stringify([...expected.constraints].sort())) {
      const missing = expected.constraints.filter((name) => !constraintNames.includes(name));
      const unexpected = constraintNames.filter((name) => !expected.constraints.includes(name));
      problems.push(
        `${tableName.toUpperCase()}_CONSTRAINTS_MISMATCH_MISSING_${missing.join("_") || "NONE"}_EXTRA_${unexpected.join("_") || "NONE"}`,
      );
    }
    if (relation.constraints.some((constraint) => !constraint.validated)) {
      problems.push(`${tableName.toUpperCase()}_UNVALIDATED_CONSTRAINT`);
    }
    if (tableName === "sf_developer_api_keys") {
      const publicKeyCheck = relation.constraints.find(
        (constraint) => constraint.name === "sf_developer_api_keys_public_key_check",
      );
      if (!publicKeyCheck?.definition?.includes("^sfpk_(live|test)_")) {
        problems.push("SF_DEVELOPER_API_KEYS_PUBLIC_KEY_PREFIX_CHECK_MISMATCH");
      }
    }
    const indexNames = new Set(relation.indexes);
    if (expected.indexes.some((indexName) => !indexNames.has(indexName))) {
      problems.push(`${tableName.toUpperCase()}_INDEX_MISSING`);
    }
  }
  return problems;
}

export async function planDeveloperIntegrations(client) {
  const catalog = await schemaCatalog(client);
  const base = new Map(catalog.baseColumns.map((column) => [
    `${column.table_name}.${column.column_name}`,
    column,
  ]));
  const prerequisitesReady =
    base.get("sf_users.id")?.data_type === "text" &&
    base.get("sf_users.id")?.is_nullable === "NO" &&
    base.get("sf_customer_payment_links.id")?.data_type === "uuid" &&
    base.get("sf_customer_payment_links.id")?.is_nullable === "NO";
  const conflicts = [];
  if (!prerequisitesReady) conflicts.push("DEVELOPER_INTEGRATIONS_PREREQUISITES_MISSING_OR_CHANGED");

  const relationMap = new Map(catalog.relations.map((relation) => [relation.relname, relation]));
  const link = relationMap.get("sf_customer_payment_links");
  const hasSource = link?.columns.includes("source") ?? false;
  const hasSourceConstraint = link?.constraints.some(
    (constraint) => constraint.name === "sf_customer_payment_links_source_check",
  ) ?? false;
  const newTableCount = Object.keys(newTables).filter((name) => relationMap.has(name)).length;
  const hasAnyTargetObject = hasSource || hasSourceConstraint || newTableCount > 0;
  const problems = schemaProblems(catalog);
  const alreadyApplied = prerequisitesReady && problems.length === 0;
  if (hasAnyTargetObject && !alreadyApplied) {
    conflicts.push("DEVELOPER_INTEGRATIONS_PARTIAL_OR_INCOMPATIBLE_SCHEMA");
  }

  return {
    migrationId,
    checksum,
    fingerprint: digest(JSON.stringify({ checksum, catalog })),
    alreadyApplied,
    conflicts,
    schemaProblems: hasAnyTargetObject ? problems : [],
    newTables: alreadyApplied ? 0 : Object.keys(newTables).length,
    sourceColumn: alreadyApplied ? "verified" : "add",
    existingRowsRewritten: false,
    paymentExecutionEnabled: false,
  };
}

export async function applyDeveloperIntegrations(client, expectedFingerprint) {
  let committing = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SET LOCAL lock_timeout = '2s'; SET LOCAL statement_timeout = '30s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
      [migrationId],
    );
    if (!lock.rows[0].acquired) {
      throw new DeveloperIntegrationsMigrationError("DEVELOPER_INTEGRATIONS_MIGRATION_BUSY");
    }
    const plan = await planDeveloperIntegrations(client);
    if (plan.fingerprint !== expectedFingerprint) {
      throw new DeveloperIntegrationsMigrationError("STALE_DEVELOPER_INTEGRATIONS_PLAN");
    }
    if (plan.conflicts.length) throw new DeveloperIntegrationsMigrationError(plan.conflicts[0]);
    if (plan.alreadyApplied) {
      await client.query("ROLLBACK");
      return { applied: false, alreadyApplied: true, paymentExecutionEnabled: false };
    }

    await client.query(migrationSql);
    const verified = await planDeveloperIntegrations(client);
    if (!verified.alreadyApplied || verified.conflicts.length) {
      throw new DeveloperIntegrationsMigrationError(
        verified.schemaProblems[0] ?? "DEVELOPER_INTEGRATIONS_SCHEMA_VERIFICATION_FAILED",
      );
    }
    committing = true;
    await client.query("COMMIT");
    return {
      applied: true,
      newTables: Object.keys(newTables).length,
      sourceColumn: "added",
      existingRowsRewritten: false,
      paymentExecutionEnabled: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (committing) {
      throw new DeveloperIntegrationsMigrationError("DEVELOPER_INTEGRATIONS_MIGRATION_OUTCOME_UNKNOWN");
    }
    throw error;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const expected = args.find((arg) => arg.startsWith("--expected-hash="))
    ?.slice("--expected-hash=".length);
  if (process.env.SENDFLOW_DATABASE_TARGET !== "shared-external" ||
    process.env.SENDFLOW_SHARED_DATABASE_LIVE_APPROVED !== "true" ||
    !process.env.REPL_ID || process.env.NODE_ENV === "production" ||
    args.some((arg) => !["--apply", "--confirm-shared-database"].includes(arg) &&
      !/^--expected-hash=[a-f0-9]{64}$/.test(arg)) ||
    (apply && (!args.includes("--confirm-shared-database") || !expected))) {
    console.error("Stopped: shared database must be explicit; writes require --apply, --confirm-shared-database and a reviewed fingerprint.");
    process.exitCode = 1;
    return;
  }

  const pg = await import("pg");
  const { resolveRuntimeDatabaseUrl } = await import("../../../lib/db/src/connection-config.ts");
  const client = new pg.default.Client({
    connectionString: resolveRuntimeDatabaseUrl(process.env),
    application_name: "sendflow_developer_integrations_migration",
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT pg_is_in_recovery() AS read_replica");
    if (rows[0]?.read_replica) {
      throw new DeveloperIntegrationsMigrationError("SHARED_TARGET_IS_READ_ONLY_REPLICA");
    }
    if (apply) {
      console.log(JSON.stringify({
        target: "shared-external",
        ...await applyDeveloperIntegrations(client, expected),
      }));
    } else {
      await client.query("BEGIN READ ONLY");
      const plan = await planDeveloperIntegrations(client);
      await client.query("ROLLBACK");
      console.log(JSON.stringify({ target: "shared-external", ...plan }));
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(JSON.stringify({
      applied: error.code === "DEVELOPER_INTEGRATIONS_MIGRATION_OUTCOME_UNKNOWN" ? "unconfirmed" : false,
      error: error.code ?? "DEVELOPER_INTEGRATIONS_MIGRATION_FAILED",
    }));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  await run();
}
