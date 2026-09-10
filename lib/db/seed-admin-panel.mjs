import pg from "pg";
import { createHash } from "node:crypto";

const { Pool } = pg;
const panelToken = process.env.ADMIN_PANEL_TOKEN || "";
const panelEmail = (process.env.ADMIN_PANEL_EMAIL || "").trim().toLowerCase();
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!panelToken || !panelEmail || !databaseUrl) {
  throw new Error("ADMIN_PANEL_TOKEN, ADMIN_PANEL_EMAIL and the database connection are required.");
}

const panelTokenHash = createHash("sha256").update(panelToken).digest("hex");
const panelEmailHash = createHash("sha256").update(panelEmail).digest("hex");
const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    `UPDATE admin_users
     SET panel_token_hash = $1, panel_email_hash = $2, updated_at = NOW()
     WHERE is_active = true`,
    [panelTokenHash, panelEmailHash],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Expected exactly one active admin account, found ${result.rowCount ?? 0}.`);
  }
  console.log("Admin panel URL initialized.");
} finally {
  await pool.end();
}