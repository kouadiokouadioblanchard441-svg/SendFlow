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
  await mkdir(path.join(root, "server"));
  await writeFile(path.join(root, "index.cjs"), commonJsLauncher("./server/index.mjs"));
  await writeFile(path.join(root, "server/index.mjs"), 'console.log("synthetic-entry-started");');
  await writeFile(path.join(root, "public/index.html"), '<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">');
  await writeFile(path.join(root, "public/assets/app.js"), "void 0;");
  await writeFile(path.join(root, "public/assets/app.css"), "body{}");
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
    "artifacts/dist/index.cjs",
    "artifacts/dist/server/index.mjs",
    "artifacts/dist/public/index.html",
    "artifacts/dist/plesk-manifest.json",
    "artifacts/api-server/dist/index.cjs",
    "artifacts/api-server/dist/index.mjs",
    "artifacts/api-server/dist/plesk-manifest.json",
  ]) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "fixture");
  }
  const runtimeSource = path.join(root, ".runtime-fixture/node_modules");
  await mkdir(path.join(runtimeSource, "sharp"), { recursive: true });
  await mkdir(path.join(runtimeSource, "@swc/helpers"), { recursive: true });
  await writeFile(path.join(runtimeSource, "sharp/package.json"), '{"name":"sharp"}');
  await writeFile(path.join(runtimeSource, "@swc/helpers/package.json"), '{"name":"@swc/helpers"}');
  const archive = path.join(root, "artifacts/api-server/plesk-runtime-dependencies.tar.gz");
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
  assert.equal(result.files.length, 5);
  assert.ok(result.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test("stages the Plesk screenshot layout with dist/index.cjs and dist/public", async (t) => {
  const source = await fixture(t);
  const target = path.join(path.dirname(source), "artifacts", "dist");
  const result = await stagePleskWebDistribution(source, target);
  assert.equal(result.startupFile, "index.cjs");
  assert.equal(await readFile(path.join(target, "public/index.html"), "utf8"),
    '<script src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">');
  assert.equal(await readFile(path.join(target, "server/index.mjs"), "utf8"),
    'console.log("synthetic-entry-started");');
});

test("Plesk post-pull activates packaged API dependencies without Node, pnpm, git, or dirname", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  const emptyPath = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-empty-path-"));
  t.after(() => rm(emptyPath, { recursive: true, force: true }));
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "build-after-pull.sh")], {
    cwd: root,
    env: { PATH: emptyPath },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified prebuilt SendFlow Plesk packages/);
  assert.match(result.stdout, /Activated committed Linux x64 API runtime dependencies/);
  assert.equal(
    await readFile(path.join(root, "artifacts/api-server/node_modules/sharp/package.json"), "utf8"),
    '{"name":"sharp"}',
  );
  assert.doesNotMatch(result.stdout, /pnpm install|pnpm run build:plesk|node_modules.*build/i);
});

test("Plesk post-pull validation rejects an incomplete API package", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  await rm(path.join(root, "artifacts/api-server/dist/index.cjs"));
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "build-after-pull.sh")], {
    cwd: root,
    env: { PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /artifacts\/api-server\/dist\/index\.cjs/);
});

test("legacy Plesk action name works without dirname", async (t) => {
  const { root, scriptDir } = await deploymentFixture(t);
  const result = spawnSync("/bin/bash", [path.join(scriptDir, "deploy-after-push.sh")], {
    cwd: root,
    env: { PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Verified prebuilt SendFlow Plesk packages/);
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
  const entry = path.join(root, "artifacts/dist/server/index.mjs");
  await mkdir(path.dirname(entry), { recursive: true });
  await writeFile(entry, 'console.log("project-root-entry-started");');
  const launcher = path.join(root, "index.cjs");
  await writeFile(launcher, commonJsLauncher("./artifacts/dist/server/index.mjs"));
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

test("CommonJS adapter never prints sensitive import errors", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "server/index.mjs"), 'throw new Error("synthetic-private-marker");');
  const result = spawnSync(process.execPath, [path.join(root, "index.cjs")], {
    env: { NODE_ENV: "production" }, encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-marker/);
});
