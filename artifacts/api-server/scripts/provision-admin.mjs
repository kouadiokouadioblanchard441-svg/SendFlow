// Owner-only operational tool. The PIN is read from stdin, never argv, logs or source.
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
if (!args.includes("--apply") || !args.includes("--user-id") || !args.includes("--reason")
  || !["read", "write", "revoke"].includes(value("--permission"))
  || value("--reason")?.trim().length < 3 || value("--reason").length > 500) {
  throw new Error("Required: --apply --user-id ID --permission read|write|revoke --reason AUDIT_REASON");
}
if (process.env.SENDFLOW_DATABASE_TARGET === "shared-neon") {
  throw new Error("Administrator provisioning is forbidden from the shared-Neon preview");
}
if (!process.env.DATABASE_URL) throw new Error("Explicit owner DATABASE_URL required");
const revoke = value("--permission") === "revoke";
let pinHash = null;
if (!revoke) {
  const pin = readFileSync(0, "utf8").trim();
  if (!/^[0-9]{8}$/.test(pin)) throw new Error("An eight-digit administrator PIN must be supplied on stdin");
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  pinHash = ["scrypt", "v1", "32768", "8", "1", salt.toString("base64url"), key.toString("base64url")].join("$");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  // Require ownership, not merely an application role with accidental write grants.
  const owner = await client.query(`SELECT pg_has_role(current_user, relowner, 'USAGE') AS allowed
    FROM pg_class WHERE oid='public.sf_admin_grants'::regclass`);
  if (!owner.rows[0]?.allowed) throw new Error("Database owner required");
  const userId = value("--user-id");
  const user = await client.query("SELECT id FROM sf_users WHERE id=$1 AND status='active' FOR UPDATE", [userId]);
  if (!user.rows.length) throw new Error("An existing active account is required");
  if (revoke) {
    const result = await client.query("UPDATE sf_admin_grants SET revoked_at=now() WHERE user_id=$1 RETURNING user_id", [userId]);
    if (!result.rows.length) throw new Error("No administrator grant exists");
  } else {
    await client.query(`INSERT INTO sf_admin_grants(user_id,can_mutate,pin_hash) VALUES($1,$2,$3)
      ON CONFLICT(user_id) DO UPDATE SET can_mutate=excluded.can_mutate,pin_hash=excluded.pin_hash,revoked_at=NULL`,
    [userId, value("--permission") === "write", pinHash]);
  }
  await client.query("UPDATE sf_admin_sessions SET revoked_at=now(),pin_verified_until=NULL WHERE user_id=$1", [userId]);
  await client.query(`INSERT INTO sf_admin_audit_logs(admin_user_id,action,resource_type,resource_id,reason)
    VALUES(current_user,$1,'admin_access',$2,$3)`, [revoke ? "revoke_admin" : "provision_admin", userId, value("--reason")]);
  await client.query("COMMIT");
  console.info("Administrator catalogue permission updated and audited. Previous sessions revoked.");
} catch {
  await client.query("ROLLBACK");
  console.error("Administrator provisioning failed; no change committed. Check owner privileges, account status and migration.");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
