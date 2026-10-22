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
const temp = mkdtempSync(join(tmpdir(), "sendflow-isolated-admin-"));
const data = join(temp, "data"), socket = join(temp, "socket");
mkdirSync(socket, { mode: 0o700 });
const env = { PATH: process.env.PATH, HOME: temp, LANG: "C.UTF-8" };
let started = false, owner;
try {
  execFileSync("initdb", ["-D", data, "--username=sf_fixture_owner", "--auth=trust", "--no-locale", "--encoding=UTF8"],
    { env, stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", data, "-l", join(temp, "postgres.log"), "-o",
    `-F -k ${socket} -p 15433 -c listen_addresses=''`, "-w", "start"], { env, stdio: "pipe" });
  started = true;
  owner = new pg.Pool({ host: socket, port: 15433, database: "postgres", user: "sf_fixture_owner" });
  const schema = execFileSync("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit", "export",
    "--dialect", "postgresql", "--schema", "./src/schema/index.ts"],
  { cwd: root, env, encoding: "utf8", maxBuffer: 8_000_000 });
  await owner.query(schema);
  // Rehearse upgrading a pre-admin schema and repeat the real migration.
  await owner.query("DROP TABLE sf_admin_sessions, sf_admin_grants");
  const migration = readFileSync(join(root, "lib/db/migrations/2026-10-22-admin-access.sql"), "utf8");
  await owner.query(migration);
  await owner.query(migration);
  await owner.query(`CREATE ROLE sf_fixture_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT USAGE ON SCHEMA public TO sf_fixture_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO sf_fixture_app;
    REVOKE UPDATE,DELETE ON sf_admin_audit_logs FROM sf_fixture_app`);
  execFileSync("psql", ["-X", "-h", socket, "-p", "15433", "-U", "sf_fixture_owner", "-d", "postgres",
    "-v", "app_role=sf_fixture_app", "-f", join(root, "scripts/admin-access-permissions.sql")], { env, stdio: "pipe" });
  const require = createRequire(join(apiDir, "package.json"));
  const runtime = join(temp, "runtime.cjs");
  await build({
    stdin: { contents: `
      export { default as accessRouter } from "./src/routes/admin-access";
      export { adminRoutes as pricingRouter } from "./src/routes/operator-pricing";
      export { adminOperatorLogoRoutes as logoRouter } from "./src/routes/admin-operator-logos";
      export { default as otpRouter } from "./src/routes/phone-otp";
      export { loadAdminSession, hashAdminSessionToken } from "./src/lib/admin-session";
      export { respondAdminAuthError } from "./src/routes/admin";
      export { fingerprint } from "./src/lib/request-security";
      export { hashCustomerSecret } from "./src/lib/customer-auth-crypto";
      export { pool } from "@workspace/db";
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
  const url = new URL("postgresql://localhost/postgres");
  url.searchParams.set("host", socket); url.searchParams.set("port", "15433"); url.searchParams.set("user", "sf_fixture_app");
  const result = spawnSync(process.execPath, ["--test", join(apiDir, "tests/security/admin-access.integration.mjs")], {
    cwd: root, stdio: "inherit", env: {
      ...env, NODE_ENV: "development", SENDFLOW_DATABASE_TARGET: "development", DATABASE_URL: url.toString(),
      SENDFLOW_ISOLATED_RUNTIME: runtime, SENDFLOW_FIXTURE_SOCKET: socket,
      SESSION_SECRET: randomBytes(32).toString("hex"), CUSTOMER_PII_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
      CORS_ALLOWED_ORIGINS: "https://sendflow-test.invalid", LOG_LEVEL: "silent",
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (owner) await owner.end();
  if (started) execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { env, stdio: "pipe" });
  rmSync(temp, { recursive: true, force: true });
}
