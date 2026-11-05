import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, chmod } from "node:fs/promises";
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

test("Plesk post-pull build works without git or dirname in PATH", async (t) => {
  const bin = await mkdtemp(path.join(tmpdir(), "sendflow-plesk-bin-"));
  t.after(() => rm(bin, { recursive: true, force: true }));
  const fakeNode = path.join(bin, "node");
  await writeFile(fakeNode, '#!/bin/sh\nprintf "24.22.2\\\\n"\n');
  await chmod(fakeNode, 0o755);
  const fakePnpm = path.join(bin, "pnpm");
  await writeFile(fakePnpm, '#!/bin/sh\nif [ "$1" = "--version" ]; then printf "10.26.1\\\\n"; else printf "pnpm %s\\\\n" "$*"; fi\n');
  await chmod(fakePnpm, 0o755);

  const result = spawnSync("/bin/bash", [path.join(projectRoot, "scripts/plesk/build-after-pull.sh")], {
    cwd: projectRoot,
    env: { ...process.env, PATH: bin },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /pnpm install --frozen-lockfile/);
  assert.match(result.stdout, /pnpm run build:plesk/);
  assert.doesNotMatch(result.stderr, /(?:git|dirname): command not found/);
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
  await assert.rejects(verifyDistribution(root, "web"), /Public source maps/);
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
