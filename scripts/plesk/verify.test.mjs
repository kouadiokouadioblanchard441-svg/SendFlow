import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { commonJsLauncher, stagePleskWebDistribution, verifyDistribution } from "./verify.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "public/assets"), { recursive: true });
  await mkdir(path.join(root, "admin/assets"), { recursive: true });
  await mkdir(path.join(root, "server"));
  await mkdir(path.join(root, "server/api"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "index.cjs"), commonJsLauncher("./server/index.mjs"));
  await writeFile(path.join(root, "server/index.mjs"), 'console.log("synthetic-entry-started");');
  await writeFile(path.join(root, "server/api/embedded.mjs"), 'export const mounted = true;');
  for (const file of [
    "pino-file.mjs",
    "pino-pretty.mjs",
    "pino-worker.mjs",
    "thread-stream-worker.mjs",
  ]) {
    await writeFile(path.join(root, "dist", file), "export {};");
  }
  await writeFile(path.join(root, "plesk-runtime-dependencies.tar.gz"), "fixture archive");
  await writeFile(path.join(root, "public/index.html"), '<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">');
  await writeFile(path.join(root, "public/assets/app.js"), "void 0;");
  await writeFile(path.join(root, "public/assets/app.css"), "body{}");
  await writeFile(path.join(root, "admin/index.html"), '<script src="/assets/private.js"></script>');
  await writeFile(path.join(root, "admin/assets/private.js"), "void 0;");
  await writeFile(path.join(root, "admin/assets/private.css"), "body{}");
  return root;
}

async function deploymentFixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scriptDir = path.join(root, "scripts/plesk");
  await mkdir(scriptDir, { recursive: true });
  for (const name of ["build-after-pull.sh", "deploy-after-push.sh"]) {
    await writeFile(
      path.join(scriptDir, name),
      await readFile(path.join(projectRoot, "scripts/plesk", name), "utf8"),
    );
  }
  await writeFile(path.join(root, "package.json"), "{}");
  await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  for (const file of [
    "index.cjs",
    "dist/index.cjs",
    "dist/server/index.mjs",
    "dist/server/api/embedded.mjs",
    "dist/dist/pino-file.mjs",
    "dist/dist/pino-pretty.mjs",
    "dist/dist/pino-worker.mjs",
    "dist/dist/thread-stream-worker.mjs",
    "dist/public/index.html",
    "dist/admin/index.html",
    "dist/plesk-manifest.json",
  ]) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "fixture");
  }
  const runtimeSource = path.join(root, ".runtime-fixture/node_modules");
  await mkdir(path.join(runtimeSource, "argon2"), { recursive: true });
  await mkdir(path.join(runtimeSource, "sharp"), { recursive: true });
  await mkdir(path.join(runtimeSource, "@swc/helpers"), { recursive: true });
  await writeFile(path.join(runtimeSource, "argon2/package.json"), '{"name":"argon2"}');
  await writeFile(path.join(runtimeSource, "sharp/package.json"), '{"name":"sharp"}');
  await writeFile(path.join(runtimeSource, "@swc/helpers/package.json"), '{"name":"@swc/helpers"}');
  const archive = path.join(root, "dist/plesk-runtime-dependencies.tar.gz");
  const archiveResult = spawnSync("tar", [
    "-czf", archive, "-C", path.join(root, ".runtime-fixture"), "node_modules",
  ], { encoding: "utf8" });
  assert.equal(archiveResult.status, 0, archiveResult.stderr);
  await rm(path.join(root, ".runtime-fixture"), { recursive: true, force: true });
  return { root, scriptDir };
}

test("verifies a root-mounted web release and hashes its files", async (t) => {
  const root = await fixture(t);
  const result = await verifyDistribution(root, "web");
  assert.equal(result.startupFile, "index.cjs");
  assert.equal(result.files.length, 14);
  assert.ok(result.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test("Plesk GitHub build and local preflight require the same Node version", async () => {
  const workflow = await readFile(
    path.join(projectRoot, ".github/workflows/plesk-build.yml"),
    "utf8",
  );
  const buildScript = await readFile(
    path.join(projectRoot, "scripts/plesk/build.mjs"),
    "utf8",
  );
  const workflowVersion = workflow.match(/node-version:\s*([0-9.]+)/)?.[1];
  const preflightVersion = buildScript.match(/process\.version !== "v([0-9.]+)"/)?.[1];
  assert.ok(workflowVersion, "GitHub Actions must pin the Plesk build Node version");
  assert.ok(preflightVersion, "The Plesk build must validate its Node version");
  assert.equal(workflowVersion, preflightVersion);
  assert.match(workflow, /Install PostgreSQL binaries for isolated API tests/);
  assert.match(workflow, /apt-get install --no-install-recommends -y postgresql/);
  assert.match(workflow, /name initdb/);
});

test("maps private bundle URLs to files kept outside the public root", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "admin/index.html"),
    '<script src="/__sendflow_private_bundle__/assets/private.js"></script><link rel="stylesheet" href="/__sendflow_private_bundle__/assets/private.css">',
  );
  const result = await verifyDistribution(root, "web");
  assert.equal(result.startupFile, "index.cjs");
});

test("rejects private interface code in the public bundle", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "public/assets/app.js"), "function AdminAccessPage() {}");
  await assert.rejects(
    verifyDistribution(root, "web"),
    /Private interface marker found in public output/,
  );
});

test("stages the Plesk screenshot layout with dist/index.cjs and dist/public", async (t) => {
  const source = await fixture(t);
  const target = path.join(path.dirname(source), "dist");
  const result = await stagePleskWebDistribution(source, target);
  assert.equal(result.startupFile, "index.cjs");
  assert.equal(await readFile(path.join(target, "public/index.html"), "utf8"),
    '<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">');
  assert.equal(await readFile(path.join(target, "admin/index.html"), "utf8"),
    '<script src="/assets/private.js"></script>');
  assert.equal(await readFile(path.join(target, "server/index.mjs"), "utf8"),
    'console.log("synthetic-entry-started");');
});

test("Plesk post-pull activates the single application's dependencies without Node, pnpm, git, or dirname", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  const emptyPath = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-empty-path-"));
  t.after(() => rm(emptyPath, { recursive: true, force: true }));
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "build-after-pull.sh")], {
    cwd: root,
    env: { PATH: emptyPath },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /single SendFlow Plesk package/);
  assert.match(result.stdout, /Activated committed Linux x64 runtime dependencies under dist/);
  assert.equal(
    await readFile(path.join(root, "dist/node_modules/argon2/package.json"), "utf8"),
    '{"name":"argon2"}',
  );
  assert.equal(
    await readFile(path.join(root, "dist/node_modules/sharp/package.json"), "utf8"),
    '{"name":"sharp"}',
  );
  assert.doesNotMatch(result.stdout, /pnpm install|pnpm run build:plesk|node_modules.*build/i);
});

test("Plesk post-pull validation rejects an incomplete integrated API package", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  await rm(path.join(root, "dist/server/api/embedded.mjs"));
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "build-after-pull.sh")], {
    cwd: root,
    env: { PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /dist\/server\/api\/embedded\.mjs/);
});

test("Plesk post-pull does not require a separate API application", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "build-after-pull.sh")], {
    cwd: root,
    env: { PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /website and \/api in one application/);
});

test("legacy Plesk action name works without dirname", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "deploy-after-push.sh")], {
    cwd: root,
    env: { PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified the single SendFlow Plesk package/);
});

test("missing JS or CSS is an error, not an accepted SPA fallback", async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, "public/assets/app.js"));
  await assert.rejects(verifyDistribution(root, "web"), /Missing HTML asset/);
});

test("rejects missing runtime entry points", async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, "server/index.mjs"));
  await assert.rejects(verifyDistribution(root, "web"), /Missing release entry/);
});

test("rejects public source maps", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "public/assets/app.js.map"), "{}");
  await assert.rejects(verifyDistribution(root, "web"), /source maps are not included/);
});

test("rejects source maps in API release packages", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-api-map-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "index.cjs"), commonJsLauncher("./index.mjs"));
  await writeFile(path.join(root, "index.mjs"), 'console.log("api-entry");');
  await writeFile(path.join(root, "index.mjs.map"), "{}");
  await assert.rejects(verifyDistribution(root, "api"), /source maps are not included/);
});

test("rejects API bundles with machine-specific absolute Pino worker paths", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "index.mjs"),
    'function pinoBundlerAbsolutePath() { const outputDir = "/home/build/artifacts/api-server/dist"; }',
  );
  await assert.rejects(
    verifyDistribution(root, "api"),
    /machine-specific absolute Pino worker path/,
  );
});

test("rejects server-secret variable names in the public bundle without printing values", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "public/assets/app.js"), 'const name="CUSTOMER_PII_ENCRYPTION_KEY";');
  await assert.rejects(verifyDistribution(root, "web"), /Server-secret variable name/);
});

test("rejects environment files even outside the public directory", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, ".env.production"), "SYNTHETIC=fixture");
  await assert.rejects(verifyDistribution(root, "web"), /forbidden configuration/);
});

test("rejects Git metadata from the Plesk package", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, ".git/config"), "[core]");
  await assert.rejects(verifyDistribution(root, "web"), /Git metadata/);
});

test("rejects symlinks that could escape the release", async (t) => {
  const root = await fixture(t);
  await symlink(path.join(root, "server/index.mjs"), path.join(root, "public/linked.js"));
  await assert.rejects(verifyDistribution(root, "web"), /symlinks/);
});

test("CommonJS adapter imports the existing ESM entry under production", async (t) => {
  const root = await fixture(t);
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /synthetic-entry-started/);
});

test("project-root Plesk startup file imports the tracked site package", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-root-start-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const entry = path.join(root, "dist/server/index.mjs");
  await mkdir(path.dirname(entry), { recursive: true });
  await writeFile(entry, 'console.log("project-root-entry-started");');
  const launcher = path.join(root, "index.cjs");
  await writeFile(launcher, commonJsLauncher("./dist/server/index.mjs"));
  const result = spawnSync(process.execPath, [launcher], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /project-root-entry-started/);
});

test("CommonJS adapter refuses non-production startup", async (t) => {
  const root = await fixture(t);
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "development" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /synthetic-entry-started/);
});

test("CommonJS adapter safely identifies a missing package without logging importer paths", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "server/index.mjs"),
    'throw Object.assign(new Error("Cannot find package \'synthetic-runtime-package\' imported from /private/system/dist/server/index.mjs"), { code: "ERR_MODULE_NOT_FOUND" });',
  );
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plesk site startup failure details: Error\/ERR_MODULE_NOT_FOUND/);
  assert.match(result.stderr, /Plesk site startup failure category: MISSING_MODULE/);
  assert.match(result.stderr, /Plesk site missing module reference: package synthetic-runtime-package/);
  assert.match(result.stdout, new RegExp(`Plesk site Node version: ${process.version}`));
  assert.match(result.stdout, new RegExp(`Plesk site application root: ${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(result.stdout + result.stderr, /\/private\/system|synthetic-runtime-package.*private/);
});

test("CommonJS adapter logs a missing file relative to the application root only", async (t) => {
  const root = await fixture(t);
  const missingFile = path.join(root, "node_modules/synthetic-esm/index.mjs");
  const message = `require() of ES Module ${missingFile} from /private/system/loader.cjs not supported.`;
  await writeFile(
    path.join(root, "server/index.mjs"),
    `throw Object.assign(new Error(${JSON.stringify(message)}), { code: "ERR_REQUIRE_ESM" });`,
  );
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plesk site startup failure category: MISSING_MODULE/);
  assert.match(result.stderr, /Plesk site missing module reference: file node_modules\/synthetic-esm\/index\.mjs/);
  assert.doesNotMatch(result.stdout + result.stderr, /\/private\/system|\/tmp\/sendflow-plesk-[^ ]+\/node_modules/);
});

test("CommonJS adapter reports a safe error name when no system code exists", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "server/index.mjs"), 'throw new TypeError("synthetic-private-marker");');
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plesk site startup failure details: TypeError/);
  assert.match(result.stderr, /Plesk site startup failure category: UNCLASSIFIED/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-marker/);
});

test("CommonJS adapter classifies database configuration errors without logging values", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "server/index.mjs"),
    'throw new Error("External database configuration is invalid. synthetic-private-marker");',
  );
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plesk site startup failure category: INVALID_DATABASE_URL/);
  assert.match(result.stderr, /Plesk site configuration check: Check the production database URL format/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-marker/);
});

test("Plesk startup diagnostics list required names without exposing environment values", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "index.cjs"), commonJsLauncher("./index.mjs"));
  await writeFile(path.join(root, "index.mjs"), 'throw new Error("synthetic-private-marker");');
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "legacy-url-must-not-be-used-in-production",
      DATABASE_CA_CERT: "synthetic-private-marker",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plesk API runtime variables unset: SENDFLOW_DATABASE_TARGET, TRUST_PROXY_HOPS, CORS_ALLOWED_ORIGINS, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, SUPABASE_DATABASE_URL/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-marker|legacy-url-must-not-be-used-in-production/);
});

test("CommonJS adapter starts without requiring PORT", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "server/index.mjs"),
    'console.log("synthetic-entry-started-without-port");',
  );
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /synthetic-entry-started-without-port/);
  assert.doesNotMatch(result.stdout + result.stderr, /INVALID_PORT|runtime variables unset: .*PORT/);
});

test("CommonJS adapter identifies missing production configuration without exposing values", async (t) => {
  const root = await fixture(t);
  await writeFile(
    path.join(root, "server/index.mjs"),
    'throw new Error("TRUST_PROXY_HOPS must be explicitly configured in production");',
  );
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TRUST_PROXY_HOPS/);
  assert.doesNotMatch(result.stderr, /explicitly configured in production/);
});
