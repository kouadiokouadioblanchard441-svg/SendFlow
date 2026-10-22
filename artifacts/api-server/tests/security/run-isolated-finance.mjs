// This runner NEVER accepts a database URL. It creates and destroys its own
// PostgreSQL cluster on a private Unix socket with TCP disabled.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { build } from "esbuild";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const apiDir = join(root, "artifacts/api-server");
const temp = mkdtempSync(join(tmpdir(), "sendflow-isolated-finance-"));
const data = join(temp, "data"), socket = join(temp, "socket");
mkdirSync(socket, { mode: 0o700 });
const baseEnv = { PATH: process.env.PATH, HOME: temp, LANG: "C.UTF-8" };
let started = false, owner;
let exitCode = 1;
try {
  execFileSync("initdb", ["-D", data, "--username=sf_fixture_owner", "--auth=trust", "--no-locale", "--encoding=UTF8"],
    { env: baseEnv, stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(temp, "postgres.log"), "-o",
    `-F -k ${socket} -p 15432 -c listen_addresses='' -c max_connections=30`, "-w", "start"],
    { env: baseEnv, stdio: "pipe" });
  started = true;
  owner = new pg.Pool({ host: socket, port: 15432, database: "postgres", user: "sf_fixture_owner" });
  const schema = execFileSync("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit", "export",
    "--dialect", "postgresql", "--schema", "./src/schema/index.ts"],
  { cwd: root, env: baseEnv, encoding: "utf8", maxBuffer: 8_000_000 });
  await owner.query(schema);
  // Simulate upgrading the old schema, including an existing metadata-only receipt.
  await owner.query(`DROP TABLE sf_api_request_limits;
    ALTER TABLE sf_identity_verifications DROP COLUMN last_provider_event_at;
    ALTER TABLE sf_identity_webhook_events DROP COLUMN payload_digest, DROP COLUMN encrypted_payload,
      DROP COLUMN status, DROP COLUMN status_applied;
    INSERT INTO sf_identity_webhook_events(event_id,provider_session_id,event_type)
      VALUES('legacy-fixture','legacy-session','status.updated')`);
  const migration = readFileSync(join(root, "lib/db/migrations/2026-10-22-financial-audit-hardening.sql"), "utf8");
  await owner.query(migration);
  await owner.query(migration);
  const reconciliationMigration = readFileSync(join(root,
    "lib/db/migrations/2026-10-22-identity-reconciliation.sql"), "utf8");
  await owner.query(reconciliationMigration);
  await owner.query(reconciliationMigration);
  const previewMigration = readFileSync(join(root, "lib/db/migrations/2026-10-22-preview-access.sql"), "utf8");
  await owner.query(previewMigration);
  await owner.query(previewMigration);
  const ipMigration = readFileSync(join(root, "lib/db/migrations/2026-10-22-ip-blocklist.sql"), "utf8");
  await owner.query("DROP TABLE sf_ip_blocklist");
  await owner.query(ipMigration);
  await owner.query(ipMigration);
  await owner.query(`CREATE ROLE sf_fixture_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT USAGE ON SCHEMA public TO sf_fixture_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sf_fixture_app`);
  // Exercise the real activation ACL script, not a hand-written approximation.
  execFileSync("psql", ["-X", "-h", socket, "-p", "15432", "-U", "sf_fixture_owner",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "app_role=sf_fixture_app",
    "-v", "approve_permissions=yes", "-f", join(root, "scripts/financial-activation/permissions.sql")],
  { env: baseEnv, stdio: "pipe" });

  const require = createRequire(join(apiDir, "package.json"));
  const runtime = join(temp, "runtime.cjs");
  await build({
    stdin: { contents: `
      export { default as app } from "./src/app";
      export { pool } from "@workspace/db";
      export { executeAdminWalletAdjustment } from "./src/services/wallet-adjustment";
      export { consumeTransferQuoteQuota } from "./src/data/transfer-quote-quota";
      export { getAccountLimitSnapshot } from "./src/lib/account-limit";
      export { reconcileIdentityVerification } from "./src/services/identity-reconciliation";
      export { retrieveDiditDecision } from "./src/lib/didit";
      export { hashCustomerSessionToken } from "./src/lib/customer-auth-crypto";
      export { hashCustomerSecret } from "./src/lib/customer-auth-crypto";
      export { provisionPreviewAccount } from "./src/services/provision-preview-account";
      export { createSensitiveDataLookupIndex } from "./src/lib/sensitive-data-crypto";
      export { decryptSensitiveData } from "./src/lib/sensitive-data-crypto";
      export { createIpBlock, revokeIpBlock, listIpBlocks } from "./src/services/ip-blocklist";
      export { isIpBlocked, enforceIpAccess } from "@workspace/db/ip-blocklist";
      export { createAdminIpBlocklistRouter } from "./src/routes/admin-ip-blocklist";
      export { createSiteServer } from "../sendflow/server/site-server";
      export { default as express } from "express";
    `, resolveDir: apiDir },
    outfile: runtime, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "external-installed-packages", setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.path.startsWith("@workspace/") || args.path.startsWith("node:")) return;
        try { return { path: require.resolve(args.path), external: true }; } catch { return; }
      });
    } }],
  });
  const databaseUrl = new URL("postgresql://localhost/postgres");
  databaseUrl.searchParams.set("host", socket);
  databaseUrl.searchParams.set("port", "15432");
  databaseUrl.searchParams.set("user", "sf_fixture_app");
  const result = spawnSync(process.execPath, ["--test", join(apiDir, "tests/security/finance.integration.mjs")], {
    cwd: root, stdio: "inherit", env: {
      ...baseEnv, NODE_PATH: join(apiDir, "node_modules"),
      NODE_ENV: "development", SENDFLOW_DATABASE_TARGET: "development",
      DATABASE_URL: databaseUrl.toString(), SENDFLOW_ISOLATED_RUNTIME: runtime,
      SENDFLOW_FIXTURE_SOCKET: socket, SESSION_SECRET: randomBytes(32).toString("hex"),
      CUSTOMER_PII_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
      DIDIT_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
      DIDIT_ENVIRONMENT: "sandbox", CORS_ALLOWED_ORIGINS: "https://sendflow-test.invalid",
      DIDIT_WORKFLOW_ID: "fixture-workflow",
      TRUST_PROXY_HOPS: "1", LOG_LEVEL: "silent",
    },
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} finally {
  if (owner) await owner.end();
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"],
    { env: baseEnv, stdio: "pipe" });
  rmSync(temp, { recursive: true, force: true });
}
process.exitCode = exitCode;
