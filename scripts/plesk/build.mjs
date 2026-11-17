import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  statfs,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  commonJsLauncher,
  stagePleskWebDistribution,
  verifyDistribution,
} from "./verify.mjs";
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
    throw new Error(
      "Plesk build command failed; inspect the preceding build output",
    );
  }
  return result;
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

try {
  if (process.version !== "v24.22.3") {
    throw new Error(
      `Plesk production builds require Node.js 24.22.3; found ${process.version}`,
    );
  }
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error(
      `Plesk runtime dependencies must be packaged on Linux x64; found ${process.platform}-${process.arch}`,
    );
  }
  const disk = await statfs(root);
  if (disk.bavail * disk.bsize < 1024 ** 3)
    throw new Error("At least 1 GiB of free build space is required");
  const pnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (pnpm.status !== 0)
    throw new Error("pnpm is required; do not replace the lockfile");
  if (pnpm.stdout.trim() !== "10.26.1") {
    throw new Error(
      `Plesk production builds require pnpm 10.26.1; found ${pnpm.stdout.trim()}`,
    );
  }
  console.log(
    `Plesk build preflight: Node ${process.version}; pnpm ${pnpm.stdout.trim()}; disk check passed.`,
  );
  console.log(
    "Build only: no production startup, migration, provider call or deployment.",
  );
  run("pnpm", ["run", "check:secrets"]);
  run("pnpm", ["run", "typecheck"]);
  run("pnpm", ["run", "test:db-connection"]);
  run("pnpm", ["run", "test:plesk-build"]);
  run("pnpm", ["--filter", "@workspace/sendflow", "run", "test:auth-routing"]);

  // One Passenger process serves the root-mounted site and same-origin /api.
  // Do not change stored environments.
  const buildEnvironment = {
    ...process.env,
    NODE_ENV: "production",
    BASE_PATH: "/",
  };
  const pleskWebDistribution = path.join(root, "dist");
  run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
    env: buildEnvironment,
  });
  run("pnpm", ["--filter", "@workspace/sendflow", "run", "build"], {
    env: buildEnvironment,
  });
  const apiBuildDirectory = path.join(root, "artifacts/api-server/dist");
  const webBuildDirectory = path.join(root, "artifacts/sendflow/dist");
  const embeddedApiDirectory = path.join(webBuildDirectory, "server/api");
  const embeddedApiFiles = ["embedded.mjs"];
  const pinoWorkerFiles = [
    "pino-file.mjs",
    "pino-pretty.mjs",
    "pino-worker.mjs",
    "thread-stream-worker.mjs",
  ];
  await mkdir(embeddedApiDirectory, { recursive: true });
  const pinoWorkerDirectory = path.join(webBuildDirectory, "dist");
  await mkdir(pinoWorkerDirectory, { recursive: true });
  for (const filename of embeddedApiFiles) {
    await copyFile(
      path.join(apiBuildDirectory, filename),
      path.join(embeddedApiDirectory, filename),
    );
  }
  for (const filename of pinoWorkerFiles) {
    await copyFile(
      path.join(apiBuildDirectory, filename),
      path.join(pinoWorkerDirectory, filename),
    );
  }
  const runtimePackage = await packageApiRuntimeDependencies({
    root,
    output: path.join(webBuildDirectory, "plesk-runtime-dependencies.tar.gz"),
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
  const siteLauncher = path.join(webBuildDirectory, "index.cjs");
  await writeFile(siteLauncher, commonJsLauncher("./server/index.mjs"), {
    mode: 0o644,
  });
  run(process.execPath, ["--check", siteLauncher]);
  run(process.execPath, ["--check", path.join(webBuildDirectory, "server/index.mjs")]);
  run(process.execPath, ["--check", path.join(embeddedApiDirectory, "embedded.mjs")]);
  const webManifest = {
    ...metadata,
    ...(await verifyDistribution(webBuildDirectory, "web")),
    runtimeDependencies: runtimePackage,
    integratedApi: {
      mountPath: "/api",
      entry: "server/api/embedded.mjs",
      supportFiles: pinoWorkerFiles.map((filename) => `dist/${filename}`),
    },
  };
  await writeFile(
    path.join(webBuildDirectory, "plesk-manifest.json"),
    `${JSON.stringify(webManifest, null, 2)}\n`,
    { mode: 0o644 },
  );
  console.log(
    `Plesk single-application package: ${webManifest.files.length} files verified; ${webBuildDirectory}/index.cjs ready.`,
  );
  const stagedWeb = await stagePleskWebDistribution(
    webBuildDirectory,
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
  const stagedManifest = {
    ...metadata,
    ...stagedWeb,
    runtimeDependencies: runtimePackage,
    integratedApi: webManifest.integratedApi,
  };
  await writeFile(
    path.join(pleskWebDistribution, "plesk-manifest.json"),
    `${JSON.stringify(stagedManifest, null, 2)}\n`,
    { mode: 0o644 },
  );
  run(
    "pnpm",
    ["--filter", "@workspace/api-server", "run", "test:signup-endpoints:isolated"],
    {
      env: {
        ...buildEnvironment,
        SENDFLOW_PLESK_SITE_DIST: pleskWebDistribution,
      },
    },
  );
  console.log(
    `Plesk application package: ${path.relative(root, pleskWebDistribution)}/index.cjs serves the website and /api on one listener.`,
  );
  console.log("Plesk project-root startup file: index.cjs ready.");
  console.log(
    `Plesk integrated API runtime dependencies: ${runtimePackage.sizeBytes} bytes; Linux x64 package ready.`,
  );
  console.log(
    "SUCCESS: Plesk distributions generated. Read docs/plesk-build.md before deploying.",
  );
} catch (error) {
  // Our own diagnostics have no supplied values; subprocess output is from the existing build scripts.
  console.error(error instanceof Error ? error.message : "Plesk build failed");
  process.exitCode = 1;
}
