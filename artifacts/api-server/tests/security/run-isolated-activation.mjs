// No URL argument or inherited credentials: disposable Unix-socket PostgreSQL only.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const temp = mkdtempSync(join(tmpdir(), "sendflow-isolated-activation-"));
const socket = join(temp, "socket"), data = join(temp, "data");
mkdirSync(socket, { mode: 0o700 });
const env = { PATH: process.env.PATH, HOME: temp, LANG: "C.UTF-8" };
const cli = ["-h", socket, "-p", "15433", "-U", "sf_activation_owner"];
const sqlDir = join(root, "scripts/financial-activation");
const migration = readFileSync(join(root, "lib/db/migrations/2026-10-22-financial-audit-hardening.sql"), "utf8");
let owner, app, restored, started = false, checks = 0;
function psql(file, { ok = true, role = "sf_activation_app", phase = "after", db = "postgres",
  approve = true, user = "sf_activation_owner" } = {}) {
  const result = spawnSync("psql", ["-X", ...cli, "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1",
    "-v", `app_role=${role}`, "-v", `phase=${phase}`,
    ...(approve ? ["-v", "approve_permissions=yes"] : []), "-f", join(sqlDir, file)],
  { env, cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  assert.equal(result.status === 0, ok, `${file}: ${result.stdout}\n${result.stderr}`);
}
async function denied(pool, sql, code = "42501") {
  await assert.rejects(pool.query(sql), (error) => error.code === code);
}
async function check(name, fn) {
  await fn();
  console.log(`ok ${++checks} - ${name}`);
}
try {
  execFileSync("initdb", ["-D", data, "--username=sf_activation_owner", "--auth=trust", "--no-locale", "--encoding=UTF8"],
    { env, stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(temp, "postgres.log"), "-o",
    `-F -k ${socket} -p 15433 -c listen_addresses=''`, "-w", "start"], { env, stdio: "pipe" });
  started = true;
  const connection = { host: socket, port: 15433, database: "postgres" };
  owner = new pg.Pool({ ...connection, user: "sf_activation_owner" });
  app = new pg.Pool({ ...connection, user: "sf_activation_app" });
  const schema = execFileSync("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit", "export",
    "--dialect", "postgresql", "--schema", "./src/schema/index.ts"],
  { cwd: root, env, encoding: "utf8", maxBuffer: 8_000_000 });
  await owner.query(schema);
  await owner.query(`DROP TABLE sf_api_request_limits;
    ALTER TABLE sf_identity_webhook_events DROP COLUMN payload_digest,DROP COLUMN encrypted_payload,
      DROP COLUMN status,DROP COLUMN status_applied;
    ALTER TABLE sf_identity_verifications DROP COLUMN last_provider_event_at;
    CREATE ROLE sf_activation_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO sf_activation_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO sf_activation_app;
    INSERT INTO sf_identity_webhook_events(event_id,provider_session_id,event_type)
      VALUES ('legacy-event','legacy-session','status.updated');
    INSERT INTO sf_users(id,display_name) VALUES('fixture','Fixture');
    INSERT INTO sf_wallets(id,user_id,balance_minor)
      VALUES('00000000-0000-0000-0000-000000000001','fixture',100);
    INSERT INTO sf_wallet_ledger(wallet_id,user_id,direction,amount_minor,balance_before_minor,
      balance_after_minor,currency,reason,admin_user_id,idempotency_key)
      VALUES('00000000-0000-0000-0000-000000000001','fixture','credit',100,0,100,'XOF','fixture','fixture','fixture');
    INSERT INTO sf_admin_audit_logs(admin_user_id,action,resource_type,resource_id)
      VALUES('fixture','credit_wallet','wallet','fixture')`);
  const baseline = {};
  for (const tbl of ["sf_wallet_ledger", "sf_admin_audit_logs", "sf_identity_webhook_events"]) {
    baseline[tbl] = (await owner.query(`SELECT * FROM ${tbl}`)).rows;
  }
  await check("legacy schema preflight is read-only and accepts absent additive objects", async () => {
    psql("preflight.sql", { phase: "before" });
    assert.equal((await owner.query("SELECT to_regclass('public.sf_api_request_limits') AS obj")).rows[0].obj, null);
  });
  await check("wrong pre-existing additive type is rejected (IF NOT EXISTS cannot repair it)", async () => {
    await owner.query("ALTER TABLE sf_identity_webhook_events ADD COLUMN status_applied text");
    psql("preflight.sql", { phase: "before", ok: false });
    await owner.query("ALTER TABLE sf_identity_webhook_events DROP COLUMN status_applied");
  });
  await check("partial pre-existing quota table and inherited history table are rejected", async () => {
    await owner.query(`CREATE TABLE sf_api_request_limits(bucket_hash varchar(64) PRIMARY KEY,
      request_count integer NOT NULL CONSTRAINT sf_api_request_limits_count_check CHECK(request_count BETWEEN 1 AND 60))`);
    psql("preflight.sql", { phase: "before", ok: false });
    await owner.query(`DROP TABLE sf_api_request_limits;
      CREATE TABLE public.fixture_child () INHERITS (sf_admin_audit_logs)`);
    psql("preflight.sql", { phase: "before", ok: false });
    await owner.query("DROP TABLE public.fixture_child");
  });
  const backup = join(temp, "before.dump");
  await check("synthetic baseline backup is restorable with ownership, ACL and exact historical rows", async () => {
    execFileSync("pg_dump", [...cli, "-d", "postgres", "-Fc", "-f", backup], { env, stdio: "pipe" });
    await owner.query("CREATE DATABASE sf_activation_restore OWNER sf_activation_owner");
    execFileSync("pg_restore", [...cli, "-d", "sf_activation_restore", "--exit-on-error", backup], { env, stdio: "pipe" });
    restored = new pg.Pool({ ...connection, database: "sf_activation_restore", user: "sf_activation_owner" });
    for (const [tbl, rows] of Object.entries(baseline)) {
      assert.deepEqual((await restored.query(`SELECT * FROM ${tbl}`)).rows, rows);
    }
    assert.deepEqual((await restored.query(`SELECT relname,relowner,relacl FROM pg_class
      WHERE relname IN ('sf_wallet_ledger','sf_admin_audit_logs') ORDER BY relname`)).rows,
    (await owner.query(`SELECT relname,relowner,relacl FROM pg_class
      WHERE relname IN ('sf_wallet_ledger','sf_admin_audit_logs') ORDER BY relname`)).rows);
    psql("preflight.sql", { phase: "before", db: "sf_activation_restore" });
  });
  await check("target migration runs twice, preserves history, and upgrades restored baseline too", async () => {
    await owner.query(migration);
    await owner.query(migration);
    await restored.query(migration);
    psql("permissions.sql", { db: "sf_activation_restore" });
    psql("preflight.sql", { db: "sf_activation_restore", user: "sf_activation_app" });
    for (const tbl of ["sf_wallet_ledger", "sf_admin_audit_logs"]) {
      assert.deepEqual((await owner.query(`SELECT * FROM ${tbl}`)).rows, baseline[tbl]);
    }
    const legacy = (await owner.query("SELECT * FROM sf_identity_webhook_events WHERE event_id='legacy-event'")).rows[0];
    for (const [key, value] of Object.entries(baseline.sf_identity_webhook_events[0])) {
      assert.deepEqual(legacy[key], value);
    }
    for (const col of ["payload_digest", "encrypted_payload", "status", "status_applied"]) assert.equal(legacy[col], null);
  });
  await check("permissions require an explicit command-line approval and safe role", async () => {
    psql("permissions.sql", { approve: false, ok: false });
    psql("permissions.sql", { role: "sf_activation_owner", ok: false });
    psql("preflight.sql", { ok: false }); // not yet least-privileged
  });
  await check("inherited and SET ROLE elevation is refused, even NOINHERIT", async () => {
    await owner.query(`CREATE ROLE sf_activation_parent;
      GRANT sf_activation_parent TO sf_activation_app;
      ALTER ROLE sf_activation_app NOINHERIT`);
    psql("permissions.sql", { ok: false });
    await owner.query("REVOKE sf_activation_parent FROM sf_activation_app");
  });
  await check("object ownership, parameter grants and SECURITY DEFINER bypasses are refused", async () => {
    await owner.query("ALTER TABLE sf_wallet_ledger OWNER TO sf_activation_app");
    psql("permissions.sql", { ok: false });
    await owner.query(`ALTER TABLE sf_wallet_ledger OWNER TO sf_activation_owner;
      GRANT SET ON PARAMETER session_replication_role TO sf_activation_app`);
    psql("permissions.sql", { ok: false });
    await owner.query(`REVOKE SET ON PARAMETER session_replication_role FROM sf_activation_app;
      CREATE FUNCTION public.fixture_elevation() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'`);
    psql("permissions.sql", { ok: false });
    await owner.query("DROP FUNCTION public.fixture_elevation()");
  });
  await check("PUBLIC and column-level UPDATE grants removed atomically; script is repeatable", async () => {
    await owner.query(`GRANT CREATE ON SCHEMA public TO PUBLIC;
      GRANT UPDATE,DELETE,TRUNCATE,TRIGGER ON sf_wallet_ledger,sf_admin_audit_logs TO PUBLIC;
      GRANT UPDATE(reason) ON sf_wallet_ledger TO PUBLIC,sf_activation_app;
      GRANT UPDATE(reason) ON sf_admin_audit_logs TO PUBLIC,sf_activation_app`);
    psql("permissions.sql");
    psql("permissions.sql");
    psql("preflight.sql");
    psql("preflight.sql", { user: "sf_activation_app" });
    assert.equal((await app.query("SELECT has_any_column_privilege(current_user,'sf_wallet_ledger','UPDATE') AS ok")).rows[0].ok, false);
  });
  await check("app cannot update, delete or truncate either history table (ACL error, not just trigger)", async () => {
    for (const tbl of ["sf_wallet_ledger", "sf_admin_audit_logs"]) {
      await denied(app, `UPDATE ${tbl} SET reason='tampered'`);
      await denied(app, `DELETE FROM ${tbl}`);
      await denied(app, `TRUNCATE ${tbl}`);
      assert.deepEqual((await owner.query(`SELECT * FROM ${tbl}`)).rows, baseline[tbl]);
    }
  });
  await check("app cannot disable/drop triggers, replace the function or change replication mode", async () => {
    await denied(app, "ALTER TABLE sf_wallet_ledger DISABLE TRIGGER ALL");
    await denied(app, "DROP TRIGGER sf_wallet_ledger_append_only ON sf_wallet_ledger");
    await denied(app, `CREATE OR REPLACE FUNCTION public.sf_reject_financial_history_mutation()
      RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'`);
    await denied(app, "SET session_replication_role=replica");
    await denied(app, "SET ROLE sf_activation_owner");
  });
  await check("active triggers also reject DBA UPDATE/DELETE/TRUNCATE while enabled", async () => {
    for (const tbl of ["sf_wallet_ledger", "sf_admin_audit_logs"]) {
      await denied(owner, `UPDATE ${tbl} SET reason='tampered'`, "23514");
      await denied(owner, `DELETE FROM ${tbl}`, "23514");
      await denied(owner, `TRUNCATE ${tbl}`, "23514");
    }
  });
  await check("disabled or altered trigger/function is detected without destructive probes", async () => {
    await owner.query("ALTER TABLE sf_wallet_ledger DISABLE TRIGGER sf_wallet_ledger_append_only");
    psql("preflight.sql", { ok: false });
    await owner.query("ALTER TABLE sf_wallet_ledger ENABLE TRIGGER sf_wallet_ledger_append_only");
    await owner.query(`CREATE OR REPLACE FUNCTION public.sf_reject_financial_history_mutation()
      RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS 'BEGIN RETURN NEW; END'`);
    psql("preflight.sql", { ok: false });
    await owner.query(migration);
    psql("preflight.sql");
  });
  await check("existing preview guards keep firing after direct EXECUTE is revoked", async () => {
    await owner.query(readFileSync(join(root, "lib/db/migrations/2026-10-22-preview-access.sql"), "utf8"));
    psql("preflight.sql", { ok: false }); // default PUBLIC EXECUTE on elevated trigger functions
    psql("permissions.sql");
    psql("preflight.sql", { user: "sf_activation_app" });
    assert.equal((await app.query(`SELECT has_function_privilege(current_user,
      'public.sf_guard_preview_password()','EXECUTE') AS ok`)).rows[0].ok, false);
    await owner.query(`INSERT INTO sf_preview_access(slot,user_id,expires_at)
      VALUES(1,'fixture',now()+interval '1 hour')`);
    // The same restricted caller still fires the SECURITY DEFINER trigger.
    await denied(app, `INSERT INTO sf_customer_credentials(user_id,password_hash,pin_hash,
      privacy_accepted_at,privacy_policy_version) VALUES('fixture','ordinary-hash','fixture',now(),'fixture')`);
    await denied(app, `INSERT INTO sf_customer_sessions(user_id,token_hash,expires_at)
      VALUES('fixture','ordinary-session',now()+interval '1 hour')`);
  });
  await check("append INSERT and quota upsert remain available to runtime; quota check enforced", async () => {
    await app.query(`INSERT INTO sf_admin_audit_logs(admin_user_id,action,resource_type,resource_id)
      VALUES('fixture','credit_wallet','wallet','second')`);
    await app.query(`INSERT INTO sf_wallet_ledger(wallet_id,user_id,direction,amount_minor,balance_before_minor,
      balance_after_minor,currency,reason,admin_user_id,idempotency_key)
      VALUES('00000000-0000-0000-0000-000000000001','fixture','debit',1,100,99,'XOF','fixture','fixture','second')`);
    await app.query(`INSERT INTO sf_api_request_limits VALUES(repeat('a',64),now(),1)
      ON CONFLICT(bucket_hash) DO UPDATE SET request_count=sf_api_request_limits.request_count+1`);
    await app.query(`INSERT INTO sf_api_request_limits VALUES(repeat('a',64),now(),1)
      ON CONFLICT(bucket_hash) DO UPDATE SET request_count=sf_api_request_limits.request_count+1`);
    assert.equal((await app.query("SELECT request_count FROM sf_api_request_limits")).rows[0].request_count, 2);
    await denied(app, "UPDATE sf_api_request_limits SET request_count=61", "23514");
  });
  console.log(`PASS: ${checks} isolated activation checks; no external database or provider contacted.`);
} finally {
  await Promise.all([owner?.end(), app?.end(), restored?.end()]);
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { env, stdio: "pipe" });
  rmSync(temp, { recursive: true, force: true });
}
