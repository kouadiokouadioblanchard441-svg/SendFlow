import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";

const { Pool } = pg;
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "";
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!email || !password || !databaseUrl) {
  throw new Error("ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD and the database connection are required.");
}

const salt = randomBytes(16);
const derivedKey = scryptSync(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true, updated_at = NOW()`,
    [email, passwordHash],
  );
  console.log("Admin account initialized.");
} finally {
  await pool.end();
}