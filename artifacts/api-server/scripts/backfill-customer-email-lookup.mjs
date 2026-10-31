// Fills only the customer email lookup hash; it never alters email ciphertext,
// phone numbers, credentials, or financial records. Dry-run is the default.
import pg from "pg";
import { resolveRuntimeDatabaseUrl } from "../../../lib/db/src/connection-config.ts";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  normalizeSensitiveEmailForLookup,
} from "../src/lib/sensitive-data-crypto.ts";

const mode = process.env.SENDFLOW_EMAIL_LOOKUP_BACKFILL_MODE ?? "dry-run";
const confirmation = process.env.SENDFLOW_EMAIL_LOOKUP_BACKFILL_CONFIRM;
const pageSize = 200;

if (!["dry-run", "apply"].includes(mode)) {
  throw new Error("SENDFLOW_EMAIL_LOOKUP_BACKFILL_MODE must be dry-run or apply");
}
if (mode === "apply" && confirmation !== "SEND_FLOW_EMAIL_LOOKUP_BACKFILL_APPLY") {
  throw new Error("Apply mode requires explicit email-index confirmation");
}

const connectionString = resolveRuntimeDatabaseUrl(process.env);
const usesSharedExternalDatabase = process.env.SENDFLOW_DATABASE_TARGET === "shared-external";

function getPoolOptions() {
  if (!usesSharedExternalDatabase) return { connectionString };

  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (!ca) throw new Error("DATABASE_CA_CERT is required for the shared external database");
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("The shared external database requires verified TLS");
  }
  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");
  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname },
  };
}

const pool = new pg.Pool({
  ...getPoolOptions(),
  max: 1,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
});

function getLookupHash(encryptedEmail) {
  const email = decryptSensitiveDataIfEncrypted(encryptedEmail, "user-email");
  if (!email) return null;
  const normalized = normalizeSensitiveEmailForLookup(email);
  if (
    normalized.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) return null;
  return createSensitiveDataLookupIndex(normalized, "user-email");
}

async function scanEmailHashes(client) {
  const seen = new Set();
  let afterId = null;
  let missing = 0;
  let duplicates = 0;
  let mismatches = 0;
  let invalidEmails = 0;

  while (true) {
    const query = afterId
      ? `SELECT id, email_encrypted, email_lookup_hash
         FROM public.sf_users
         WHERE id > $1 AND email_encrypted IS NOT NULL
         ORDER BY id LIMIT $2`
      : `SELECT id, email_encrypted, email_lookup_hash
         FROM public.sf_users
         WHERE email_encrypted IS NOT NULL
         ORDER BY id LIMIT $1`;
    const values = afterId ? [afterId, pageSize] : [pageSize];
    const { rows } = await client.query(query, values);

    for (const row of rows) {
      const expectedHash = getLookupHash(row.email_encrypted);
      if (!expectedHash) {
        invalidEmails += 1;
        continue;
      }
      if (seen.has(expectedHash)) duplicates += 1;
      else seen.add(expectedHash);
      if (row.email_lookup_hash === null) missing += 1;
      else if (row.email_lookup_hash !== expectedHash) mismatches += 1;
    }

    if (rows.length === 0 || rows.length < pageSize) break;
    afterId = rows.at(-1).id;
  }

  return { missing, duplicates, mismatches, invalidEmails };
}

async function run() {
  if (mode === "dry-run") {
    const client = await pool.connect();
    try {
      const report = await scanEmailHashes(client);
      console.info(JSON.stringify({
        mode,
        ...report,
        result: report.duplicates || report.mismatches
          ? "stopped_without_changes"
          : "no_changes_made",
      }));
      if (report.duplicates || report.mismatches) process.exitCode = 1;
    } finally {
      client.release();
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '120s'");

    const report = await scanEmailHashes(client);
    if (report.duplicates || report.mismatches) {
      throw new Error("Email duplicates or inconsistent hashes were found");
    }

    let afterId = null;
    let updated = 0;
    while (true) {
      const query = afterId
        ? `SELECT id, email_encrypted, email_lookup_hash
           FROM public.sf_users
           WHERE id > $1 AND email_encrypted IS NOT NULL
           ORDER BY id LIMIT $2`
        : `SELECT id, email_encrypted, email_lookup_hash
           FROM public.sf_users
           WHERE email_encrypted IS NOT NULL
           ORDER BY id LIMIT $1`;
      const values = afterId ? [afterId, pageSize] : [pageSize];
      const { rows } = await client.query(query, values);

      for (const row of rows) {
        if (row.email_lookup_hash !== null) continue;
        const emailHash = getLookupHash(row.email_encrypted);
        if (!emailHash) continue;
        const result = await client.query(
          `UPDATE public.sf_users
           SET email_lookup_hash = $1
           WHERE id = $2 AND email_lookup_hash IS NULL`,
          [emailHash, row.id],
        );
        updated += result.rowCount ?? 0;
      }

      if (rows.length === 0 || rows.length < pageSize) break;
      afterId = rows.at(-1).id;
    }

    await client.query("COMMIT");
    console.info(JSON.stringify({
      mode,
      updatedEmailLookupHashes: updated,
      invalidEmails: report.invalidEmails,
      result: "completed",
    }));
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Email lookup backfill stopped; no partial batch was committed.");
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

try {
  await run();
} catch {
  console.error("Email lookup backfill stopped without exposing database or customer details.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
