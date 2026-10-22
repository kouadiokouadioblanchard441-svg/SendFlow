// Explicit operator action only. Credentials enter via Secrets, never arguments.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import pg from "pg";

if (process.argv[2] !== "--confirm-shared-neon" || process.env.SENDFLOW_DATABASE_TARGET !== "shared-neon"
  || !process.env.REPL_ID || process.env.NODE_ENV === "production") {
  throw new Error("Explicit shared-Neon preview provisioning confirmation is required");
}
const phone = process.env.SENDFLOW_VIEWER_PHONE;
const password = process.env.SENDFLOW_VIEWER_PASSWORD;
if (!phone || !password || password.length < 8) throw new Error("Preview credentials must be supplied through Secrets");
const connectionString = process.env.NEON_DATABASE_URL_PRODUCTION;
if (!connectionString) throw new Error("Configured Neon connection is required");
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(apiDir, "../..");
const temp = mkdtempSync(join(tmpdir(), "sendflow-preview-provision-"));
const owner = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
let runtime;
let phase = "schema-check";
try {
  // Short, session-local limits: stop rather than hold up active production work.
  await owner.query("SET lock_timeout = '3s'; SET statement_timeout = '10s'");
  // Confirm schema compatibility before applying this one additive migration.
  const result = await owner.query(`select table_name, column_name from information_schema.columns
    where table_schema='public' and table_name in
    ('sf_users','sf_wallets','sf_customer_credentials','sf_customer_sessions','sf_admin_audit_logs')`);
  const has = (t, c) => result.rows.some(r => r.table_name === t && r.column_name === c);
  if (!has("sf_users", "phone_lookup_hash") || !has("sf_customer_sessions", "pin_verified_until")
    || !has("sf_customer_credentials", "privacy_policy_version") || !has("sf_wallets", "balance_minor")
    || !has("sf_admin_audit_logs", "action")) throw new Error("Required existing schema is missing; stopped without migration");
  const require = createRequire(join(apiDir, "package.json"));
  const output = join(temp, "provision.cjs");
  phase = "service-build";
  await build({
    stdin: { contents: `
      export { provisionPreviewAccount } from "./src/services/provision-preview-account";
      export { pool } from "@workspace/db";`, resolveDir: apiDir },
    outfile: output, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "installed-packages", setup(b) {
      b.onResolve({ filter: /^[^./]/ }, a => {
        if (a.path.startsWith("@workspace/") || a.path.startsWith("node:")) return;
        try { return { path: require.resolve(a.path), external: true }; } catch { return; }
      });
    } }],
  });
  // No global Drizzle push and no unrelated migrations.
  phase = "access-migration";
  await owner.query(readFileSync(join(root, "lib/db/migrations/2026-10-22-preview-access.sql"), "utf8"));
  phase = "service-load";
  runtime = require(output);
  phase = "account-provision";
  const { expiresAt } = await runtime.provisionPreviewAccount(phone, password);
  console.log(`Preview account created; access expires ${expiresAt.toISOString()}. No funds or providers involved.`);
} catch (error) {
  // Never serialize database errors, parameters, credentials or connection URLs.
  console.error("Preview provisioning stopped. No existing account was replaced. Check schema compatibility or number availability.");
  const knownReasons = new Map([
    ["Invalid preview credentials", "invalid-credentials"],
    ["A preview account is already provisioned; no replacement was made", "grant-already-exists"],
    ["The chosen number is already in use; no account was changed", "number-already-used"],
  ]);
  const reason = knownReasons.get(error?.message) ?? "unclassified";
  const sqlState = /^[0-9A-Z]{5}$/.test(error?.code ?? "") ? error.code : "unavailable";
  console.error(`Safe diagnostic: phase=${phase}; reason=${reason}; SQLSTATE=${sqlState}`);
  process.exitCode = 1;
} finally {
  await runtime?.pool.end();
  await owner.end();
  rmSync(temp, { recursive: true, force: true });
}
