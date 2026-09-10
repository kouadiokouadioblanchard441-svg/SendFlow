import pg from "pg";
import { createHash } from "node:crypto";

const { Pool } = pg;
const panelToken = process.env.ADMIN_PANEL_TOKEN || "";
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!panelToken || !databaseUrl) {
  throw new Error("ADMIN_PANEL_TOKEN and the database connection are required.");
}

const panelTokenHash = createHash("sha256").update(panelToken).digest("hex");
const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    `UPDATE admin_users
     SET panel_token_hash = $1, updated_at = NOW()
     WHERE is_active = true`,
    [panelTokenHash],
  );

  if (result.rowCount !== 1) {
    throw new Error(`Expected exactly one active admin account, found ${result.rowCount ?? 0}.`);
  }
  console.log("Admin panel URL initialized.");
} finally {
  await pool.end();
}