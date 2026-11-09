import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const temp = mkdtempSync(join(tmpdir(), "sendflow-admin-auth-schema-"));
const data = join(temp, "data");
const socket = join(temp, "socket");
const env = { PATH: process.env.PATH, HOME: temp, LANG: "C.UTF-8" };
mkdirSync(socket, { mode: 0o700 });
let started = false;
let owner;
let app;

async function expectPermissionDenied(query) {
  await assert.rejects(query, (error) => error?.code === "42501");
}

try {
  execFileSync("initdb", [
    "-D", data,
    "--username=sf_fixture_owner",
    "--auth=trust",
    "--no-locale",
    "--encoding=UTF8",
  ], { env, stdio: "pipe" });
  execFileSync("pg_ctl", [
    "-D", data,
    "-l", join(temp, "postgres.log"),
    "-o", `-F -k ${socket} -p 15434 -c listen_addresses=''`,
    "-w", "start",
  ], { env, stdio: "pipe" });
  started = true;
  owner = new pg.Pool({ host: socket, port: 15434, database: "postgres", user: "sf_fixture_owner" });

  const exportedSchema = execFileSync("pnpm", [
    "--filter", "@workspace/db", "exec", "drizzle-kit", "export",
    "--dialect", "postgresql", "--schema", "./src/schema/index.ts",
  ], {
    cwd: root,
    env,
    encoding: "utf8",
    maxBuffer: 8_000_000,
  });
  await owner.query(exportedSchema);

  await owner.query(`
    DROP TABLE IF EXISTS sf_super_admin_step_up_tokens CASCADE;
    DROP TABLE IF EXISTS sf_super_admin_refresh_tokens CASCADE;
    DROP TABLE IF EXISTS sf_super_admin_sessions CASCADE;
    DROP TABLE IF EXISTS sf_super_admin_recovery_codes CASCADE;
    DROP TABLE IF EXISTS sf_super_admin_credentials CASCADE;
    ALTER TABLE sf_admin_audit_logs
      DROP COLUMN IF EXISTS session_id,
      DROP COLUMN IF EXISTS ip_hash,
      DROP COLUMN IF EXISTS user_agent_hash,
      DROP COLUMN IF EXISTS outcome;
    DROP TABLE IF EXISTS sf_admin_sessions, sf_admin_grants CASCADE;
  `);

  const legacyMigration = readFileSync(
    join(root, "lib/db/migrations/2026-10-22-admin-access.sql"),
    "utf8",
  );
  await owner.query(legacyMigration);
  await owner.query(legacyMigration);

  const migration = readFileSync(
    join(root, "lib/db/migrations/2026-11-09-single-super-admin-auth.sql"),
    "utf8",
  );
  await owner.query(migration);
  await owner.query(migration);

  await owner.query(`
    CREATE ROLE sf_fixture_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT USAGE ON SCHEMA public TO sf_fixture_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sf_fixture_app;
  `);
  execFileSync("psql", [
    "-X", "-h", socket, "-p", "15434", "-U", "sf_fixture_owner", "-d", "postgres",
    "-v", "app_role=sf_fixture_app",
    "-f", join(root, "scripts/admin-access-permissions.sql"),
  ], { env, stdio: "pipe" });

  await owner.query(
    `INSERT INTO sf_super_admin_credentials
      (id, email_normalized, password_hash, totp_ciphertext, totp_nonce, totp_auth_tag)
     VALUES (1, 'fixture-admin@example.invalid', '$argon2id$fixture',
       'ZmFrZQ', $1, $2)`,
    [randomBytes(12).toString("base64url"), randomBytes(16).toString("base64url")],
  );
  await owner.query(
    `INSERT INTO sf_admin_audit_logs
      (admin_user_id, action, resource_type, resource_id, outcome)
     VALUES ('super-admin', 'admin_sign_in', 'admin_access', 'fixture', 'success')`,
  );

  const appUrl = new URL("postgresql://localhost/postgres");
  appUrl.searchParams.set("host", socket);
  appUrl.searchParams.set("port", "15434");
  appUrl.searchParams.set("user", "sf_fixture_app");
  app = new pg.Pool({ connectionString: appUrl.toString() });

  assert.equal(
    (await app.query("SELECT email_normalized FROM sf_super_admin_credentials WHERE id = 1")).rows[0]
      .email_normalized,
    "fixture-admin@example.invalid",
  );
  await expectPermissionDenied(app.query(
    "INSERT INTO sf_super_admin_credentials (id, email_normalized, password_hash, totp_ciphertext, totp_nonce, totp_auth_tag) VALUES (2, 'second@example.invalid', '$argon2id$fixture', 'x', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaaaa')",
  ));
  await expectPermissionDenied(app.query(
    "UPDATE sf_super_admin_credentials SET password_hash = '$argon2id$changed' WHERE id = 1",
  ));
  await app.query("UPDATE sf_super_admin_credentials SET last_totp_step = 1, updated_at = now() WHERE id = 1");

  const sessionId = randomUUID();
  const familyId = randomUUID();
  const refreshHash = randomBytes(32).toString("hex");
  await app.query(
    `INSERT INTO sf_super_admin_sessions
      (id, refresh_token_hash, refresh_family_id, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes', now() + interval '8 hours')`,
    [sessionId, refreshHash, familyId],
  );
  await app.query(
    `INSERT INTO sf_super_admin_refresh_tokens (token_hash, session_id, family_id)
     VALUES ($1, $2, $3)`,
    [refreshHash, sessionId, familyId],
  );
  await app.query(
    `INSERT INTO sf_super_admin_step_up_tokens
      (session_id, token_hash, action_key, payload_hash, expires_at)
     VALUES ($1, $2, 'POST:/fixture', $3, now() + interval '30 seconds')`,
    [sessionId, randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
  );

  const auditId = (await app.query(
    `INSERT INTO sf_admin_audit_logs
      (admin_user_id, action, resource_type, resource_id, outcome)
     VALUES ('super-admin', 'admin_step_up', 'admin_access', 'fixture', 'success')
     RETURNING id`,
  )).rows[0].id;
  await expectPermissionDenied(app.query(
    "UPDATE sf_admin_audit_logs SET outcome = 'failure' WHERE id = $1",
    [auditId],
  ));
  await assert.rejects(
    owner.query("UPDATE sf_admin_audit_logs SET outcome = 'failure' WHERE id = $1", [auditId]),
    /append-only/u,
  );

  process.stdout.write(
    "Isolated admin schema checks passed: repeated additive migrations, singleton-write denial, session token writes, and append-only audit.\n",
  );
} finally {
  if (app) await app.end();
  if (owner) await owner.end();
  if (started) {
    execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { env, stdio: "pipe" });
  }
  rmSync(temp, { recursive: true, force: true });
}
