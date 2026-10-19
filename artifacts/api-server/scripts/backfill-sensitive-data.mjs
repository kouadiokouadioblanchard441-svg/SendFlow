import { Pool } from "pg";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveDataIfEncrypted,
  encryptSensitiveData,
  normalizeSensitiveNameForLookup,
} from "../src/lib/sensitive-data-crypto.ts";

const mode = process.env.SENDFLOW_PII_BACKFILL_MODE ?? "dry-run";
const connectionString = process.env.SENDFLOW_PII_BACKFILL_DATABASE_URL;
const confirmation = process.env.SENDFLOW_PII_BACKFILL_CONFIRM;

if (!["dry-run", "apply"].includes(mode)) {
  throw new Error("SENDFLOW_PII_BACKFILL_MODE must be dry-run or apply");
}
if (!connectionString) {
  throw new Error("Set SENDFLOW_PII_BACKFILL_DATABASE_URL to an explicitly selected database");
}
if (mode === "apply" && confirmation !== "SEND_FLOW_PII_BACKFILL_APPLY") {
  throw new Error("Apply mode requires the explicit SEND_FLOW_PII_BACKFILL_CONFIRM value");
}

const parsedUrl = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
  throw new Error("Backfill target must be a PostgreSQL URL");
}
if (/\.neon\.tech$|\.replit\.(dev|app)$|\.replit\.com$/i.test(parsedUrl.hostname)) {
  throw new Error("This utility refuses shared Neon and Replit database hosts");
}

const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
const isEncrypted = (value) => typeof value === "string" && value.startsWith("sfenc-v1.");
const pageSize = 200;
const backfillTableColumns = {
  sf_users: new Set(["phone", "display_name", "birth_date::text"]),
  sf_contacts: new Set(["label", "phone"]),
  sf_transactions: new Set(["sender_phone", "recipient_phone", "provider_reference"]),
};
const backfillHashColumns = new Set([
  "phone_lookup_hash",
  "display_name_lookup_hash",
  "sender_phone_lookup_hash",
  "recipient_phone_lookup_hash",
  "provider_reference_lookup_hash",
]);

// SÉCURITÉ SQLi : les noms de table/colonne ne peuvent pas être des paramètres.
// Ils sont vérifiés contre ces listes avant d'être insérés dans la requête;
// les valeurs de données restent passées avec des placeholders PostgreSQL.
async function countLegacyRows(table, columns) {
  const allowedColumns = backfillTableColumns[table];
  if (!allowedColumns || columns.some((column) => !allowedColumns.has(column))) {
    throw new Error("Backfill count query contains an unsupported table or column");
  }
  const checks = columns.map((column) => `(${column} IS NOT NULL AND ${column} NOT LIKE 'sfenc-v1.%')`);
  const result = await pool.query(
    `SELECT count(*)::bigint AS count FROM public.${table} WHERE ${checks.join(" OR ")}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function updateBatch(statements, client) {
  if (mode === "dry-run" || statements.length === 0) return;
  await client.query("BEGIN");
  try {
    for (const statement of statements) {
      await client.query(statement.text, statement.values);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function backfillUsers(client) {
  let afterId = null;
  let changed = 0;
  while (true) {
    const { rows } = await pool.query(
      `SELECT id, phone, phone_lookup_hash, display_name, display_name_lookup_hash,
              birth_date::text AS birth_date, birth_date_encrypted
       FROM public.sf_users WHERE id > $1 ORDER BY id LIMIT $2`,
      [afterId, pageSize],
    );
    if (rows.length === 0) break;
    const statements = [];
    for (const row of rows) {
      const phone = decryptSensitiveDataIfEncrypted(row.phone, "user-phone");
      const name = decryptSensitiveDataIfEncrypted(row.display_name, "user-name");
      const birthDate = row.birth_date_encrypted
        ? decryptSensitiveDataIfEncrypted(row.birth_date_encrypted, "user-birth-date")
        : row.birth_date;
      const nextPhone = phone && !isEncrypted(row.phone)
        ? encryptSensitiveData(phone, "user-phone")
        : row.phone;
      const nextName = name && !isEncrypted(row.display_name)
        ? encryptSensitiveData(name, "user-name")
        : row.display_name;
      const nextBirthDate = birthDate && !row.birth_date_encrypted
        ? encryptSensitiveData(birthDate, "user-birth-date")
        : row.birth_date_encrypted;
      const phoneHash = phone
        ? row.phone_lookup_hash ?? createSensitiveDataLookupIndex(phone, "user-phone")
        : null;
      const nameHash = name
        ? row.display_name_lookup_hash
          ?? createSensitiveDataLookupIndex(normalizeSensitiveNameForLookup(name), "user-name")
        : null;
      if (
        nextPhone !== row.phone
        || nextName !== row.display_name
        || nextBirthDate !== row.birth_date_encrypted
        || phoneHash !== row.phone_lookup_hash
        || nameHash !== row.display_name_lookup_hash
        || row.birth_date !== null
      ) {
        statements.push({
          text: `UPDATE public.sf_users
                 SET phone = $1, phone_lookup_hash = $2,
                     display_name = $3, display_name_lookup_hash = $4,
                     birth_date = NULL, birth_date_encrypted = $5, updated_at = now()
                 WHERE id = $6`,
          values: [nextPhone, phoneHash, nextName, nameHash, nextBirthDate, row.id],
        });
      }
    }
    await updateBatch(statements, client);
    changed += statements.length;
    afterId = rows.at(-1).id;
    if (rows.length < pageSize) break;
  }
  return changed;
}

async function backfillSimpleTable(client, table, idColumn, fields) {
  // SÉCURITÉ SQLi : autoriser explicitement tous les identifiants interpolés
  // avant de fabriquer le SELECT; les valeurs sont toujours liées avec $1/$2.
  const allowedColumns = backfillTableColumns[table];
  if (
    !allowedColumns
    || idColumn !== "id"
    || fields.some((field) => !allowedColumns.has(field.column)
      || (field.lookupHashColumn && !backfillHashColumns.has(field.lookupHashColumn)))
  ) {
    throw new Error("Backfill query contains an unsupported table or column");
  }
  let afterId = null;
  let changed = 0;
  while (true) {
    const fieldList = [...new Set(fields.flatMap((field) =>
      field.lookupHashColumn ? [field.column, field.lookupHashColumn] : [field.column],
    ))].join(", ");
    const { rows } = await pool.query(
      `SELECT ${idColumn}, ${fieldList} FROM public.${table}
       WHERE ${idColumn} > $1 ORDER BY ${idColumn} LIMIT $2`,
      [afterId, pageSize],
    );
    if (rows.length === 0) break;
    const statements = [];
    for (const row of rows) {
      const assignments = [];
      const values = [];
      for (const field of fields) {
        const current = row[field.column];
        if (current === null) continue;
        const plaintext = decryptSensitiveDataIfEncrypted(current, field.purpose);
        if (!plaintext) continue;
        if (!isEncrypted(current)) {
          assignments.push(`${field.column} = $${values.length + 1}`);
          values.push(encryptSensitiveData(plaintext, field.purpose));
        }
        if (field.lookupHashColumn && row[field.lookupHashColumn] === null) {
          assignments.push(`${field.lookupHashColumn} = $${values.length + 1}`);
          values.push(createSensitiveDataLookupIndex(plaintext, field.purpose));
        }
      }
      if (assignments.length) {
        values.push(row[idColumn]);
        statements.push({
          text: `UPDATE public.${table} SET ${assignments.join(", ")} WHERE ${idColumn} = $${values.length}`,
          values,
        });
      }
    }
    await updateBatch(statements, client);
    changed += statements.length;
    afterId = rows.at(-1)[idColumn];
    if (rows.length < pageSize) break;
  }
  return changed;
}

try {
  if (mode === "dry-run") {
      const counts = await Promise.all([
      countLegacyRows("sf_users", ["phone", "display_name", "birth_date::text"]),
      countLegacyRows("sf_contacts", ["label", "phone"]),
      countLegacyRows("sf_transactions", ["sender_phone", "recipient_phone", "provider_reference"]),
    ]);
    console.info(JSON.stringify({
      mode,
      usersWithLegacyValues: counts[0],
      contactsWithLegacyValues: counts[1],
      transactionsWithLegacyValues: counts[2],
      databaseHost: parsedUrl.hostname,
    }));
  } else {
    const client = await pool.connect();
    try {
      const counts = {
        users: await backfillUsers(client),
        contacts: await backfillSimpleTable(client, "sf_contacts", "id", [
          { column: "label", purpose: "contact-label" },
          { column: "phone", purpose: "contact-phone" },
        ]),
        transactions: await backfillSimpleTable(client, "sf_transactions", "id", [
          { column: "sender_phone", lookupHashColumn: "sender_phone_lookup_hash", purpose: "transaction-sender-phone" },
          { column: "recipient_phone", lookupHashColumn: "recipient_phone_lookup_hash", purpose: "transaction-recipient-phone" },
          { column: "provider_reference", lookupHashColumn: "provider_reference_lookup_hash", purpose: "provider-reference" },
        ]),
      };
      console.info(JSON.stringify({ mode, updatedRows: counts, databaseHost: parsedUrl.hostname }));
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
