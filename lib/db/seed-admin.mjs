import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";

const { Pool } = pg;
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
const panelToken = process.env.ADMIN_PANEL_TOKEN || "";
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!email || !password || !panelToken || !databaseUrl) {
  throw new Error("ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, ADMIN_PANEL_TOKEN and the database connection are required.");
}

const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
const panelTokenHash = (await import("node:crypto")).createHash("sha256").update(panelToken).digest("hex");
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, panel_token_hash, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, panel_token_hash = EXCLUDED.panel_token_hash, is_active = true, updated_at = NOW()`,
    [email, passwordHash, panelTokenHash],
  );
  console.log("Admin account initialized.");
} finally {
  await pool.end();
}