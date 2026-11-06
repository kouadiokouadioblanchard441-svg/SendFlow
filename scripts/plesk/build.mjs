import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, rm, statfs, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { commonJsLauncher, stagePleskWebDistribution, verifyDistribution } from "./verify.mjs";
import { packageApiRuntimeDependencies } from "./package-runtime.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
process.chdir(root);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Plesk build command failed; inspect the preceding build output");
  }
  return result;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return result.status === 0 ? result.stdout.trim() : null;
}

try {
  if (process.version !== "v24.22.2") {
    throw new Error(`Plesk production builds require Node.js 24.22.2; found ${process.version}`);
  }
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error(`Plesk runtime dependencies must be packaged on Linux x64; found ${process.platform}-${process.arch}`);
  }
  const disk = await statfs(root);
  if (disk.bavail * disk.bsize < 1024 ** 3) throw new Error("At least 1 GiB of free build space is required");
  const pnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (pnpm.status !== 0) throw new Error("pnpm is required; do not replace the lockfile");
  if (pnpm.stdout.trim() !== "10.26.1") {
    throw new Error(`Plesk production builds require pnpm 10.26.1; found ${pnpm.stdout.trim()}`);
  }
  console.log(`Plesk build preflight: Node ${process.version}; pnpm ${pnpm.stdout.trim()}; disk check passed.`);
  console.log("Build only: no production startup, migration, provider call or deployment.");
  run("pnpm", ["run", "check:secrets"]);
  run("pnpm", ["run", "typecheck"]);
  run("pnpm", ["run", "test:plesk-build"]);
  run("pnpm", ["--filter", "@workspace/sendflow", "run", "test:auth-routing"]);

  // Root-mounted, same-origin Plesk release. Do not change stored environments.
  const buildEnvironment = { ...process.env, NODE_ENV: "production", BASE_PATH: "/" };
  const pleskWebDistribution = path.join(root, "dist");
  run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], { env: buildEnvironment });
  run("pnpm", ["--filter", "@workspace/sendflow", "run", "build"], { env: buildEnvironment });
  const runtimePackage = await packageApiRuntimeDependencies({
    root,
    output: path.join(root, "artifacts/api-server/plesk-runtime-dependencies.tar.gz"),
  });

  const lockfile = await readFile(path.join(root, "pnpm-lock.yaml"));
  const metadata = {
    builtAt: new Date().toISOString(),
    sourceCommit: git(["rev-parse", "HEAD"]),
    trackedWorktreeModified: git(["diff", "--name-only", "HEAD"]) !== "",
    builderNode: process.version,
    builderPnpm: pnpm.stdout.trim(),
    lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
    productionHostVerified: false,
    buildMode: "production",
    basePath: "/",
  };
  for (const [service, directory, target] of [
    ["api", "artifacts/api-server/dist", "./index.mjs"],
    ["web", "artifacts/sendflow/dist", "./server/index.mjs"],
  ]) {
    const distribution = path.join(root, directory);
    const launcher = path.join(distribution, "index.cjs");
    await writeFile(launcher, commonJsLauncher(target), { mode: 0o644 });
    run(process.execPath, ["--check", launcher]);
    run(process.execPath, ["--check", path.join(distribution, target)]);
    const manifest = {
      ...metadata,
      ...await verifyDistribution(distribution, service),
      ...(service === "api" ? { runtimeDependencies: runtimePackage } : {}),
    };
    await writeFile(path.join(distribution, "plesk-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
    console.log(`Plesk ${service}: ${manifest.files.length} files verified; ${directory}/index.cjs ready.`);
  }
  const stagedWeb = await stagePleskWebDistribution(
    path.join(root, "artifacts/sendflow/dist"),
    pleskWebDistribution,
  );
  const rootWebLauncher = path.join(root, "index.cjs");
  await writeFile(
    rootWebLauncher,
    commonJsLauncher("./dist/server/index.mjs"),
    { mode: 0o644 },
  );
  run(process.execPath, ["--check", rootWebLauncher]);
  await rm(path.join(root, "artifacts/dist"), { recursive: true, force: true });
  run("pnpm", ["run", "check:public-artifacts"]);
  const stagedManifest = { ...metadata, ...stagedWeb };
  await writeFile(
    path.join(pleskWebDistribution, "plesk-manifest.json"),
    `${JSON.stringify(stagedManifest, null, 2)}\n`,
    { mode: 0o644 },
  );
  console.log(`Plesk website package: ${path.relative(root, pleskWebDistribution)}/index.cjs and public/ ready.`);
  console.log("Plesk project-root startup file: index.cjs ready.");
  console.log(`Plesk API runtime dependencies: ${runtimePackage.sizeBytes} bytes; Linux x64 package ready.`);
  console.log("SUCCESS: Plesk distributions generated. Read docs/plesk-build.md before deploying.");
} catch (error) {
  // Our own diagnostics have no supplied values; subprocess output is from the existing build scripts.
  console.error(error instanceof Error ? error.message : "Plesk build failed");
  process.exitCode = 1;
}
