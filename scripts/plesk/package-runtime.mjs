import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, lstat, readdir, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_ARCHIVE_BYTES = 90 * 1024 * 1024;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.error || result.status !== 0) {
    const message = (result.stderr || result.stdout || "").trim();
    throw new Error(message || `Runtime packaging command failed: ${command}`);
  }
  return result.stdout;
}

function assertSafeArchiveListing(listing) {
  const entries = listing.split(/\r?\n/).filter(Boolean);
  if (!entries.includes("node_modules/sharp") || !entries.includes("node_modules/@swc/helpers")) {
    throw new Error("API runtime archive is missing an external production dependency.");
  }
  if (!entries.some((entry) =>
    /^node_modules\/\.pnpm\/@img\+sharp-linux-x64@[^/]+\/node_modules\/@img\/sharp-linux-x64\/lib\/sharp-linux-x64-[^/]+\.node$/.test(entry))) {
    throw new Error("API runtime archive is missing the Linux x64 sharp native runtime.");
  }
  for (const entry of entries) {
    if (
      entry.startsWith("/") ||
      entry === ".." ||
      entry.startsWith("../") ||
      entry.includes("/../") ||
      entry.endsWith("/..") ||
      !(entry === "node_modules" || entry.startsWith("node_modules/"))
    ) {
      throw new Error("API runtime archive contains an unsafe path.");
    }
    if (/(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(entry)) {
      throw new Error("API runtime archive contains a forbidden environment or key file.");
    }
  }
  return entries.length;
}

async function assertNoEscapingSymlinks(root, current = root) {
  const rootReal = await realpath(root);
  for (const name of await readdir(current)) {
    const filename = path.join(current, name);
    const info = await lstat(filename);
    if (info.isSymbolicLink()) {
      const target = await realpath(filename);
      const relative = path.relative(rootReal, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("API runtime package contains a symlink outside its package.");
      }
    } else if (info.isDirectory()) {
      await assertNoEscapingSymlinks(root, filename);
    } else if (info.isFile() && (
      name === ".env" ||
      name.startsWith(".env.") ||
      /\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(name)
    )) {
      throw new Error("API runtime package contains a forbidden environment or key file.");
    }
  }
}

async function smokeTestSharp(cwd) {
  const code = [
    "import sharp from 'sharp';",
    "const output = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#ffffff' } }).png().toBuffer();",
    "if (!output.length || !sharp.versions.sharp) process.exit(1);",
  ].join("\n");
  run(process.execPath, ["--input-type=module", "-e", code], { cwd });
}

export async function packageApiRuntimeDependencies({ root, output }) {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("API runtime dependencies must be packaged on Linux x64.");
  }

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "sendflow-api-runtime-"));
  const packageRoot = path.join(temporaryRoot, "api-runtime");
  const extractedRoot = path.join(temporaryRoot, "extracted");
  const outputDirectory = path.dirname(output);
  const outputTempDirectory = await mkdtemp(path.join(outputDirectory, ".plesk-runtime-package-"));
  const temporaryArchive = path.join(outputTempDirectory, "runtime-dependencies.tar.gz");

  try {
    run("pnpm", [
      "--filter", "@workspace/api-server",
      "deploy", "--prod", "--legacy", packageRoot,
    ], { cwd: root });
    const nodeModules = path.join(packageRoot, "node_modules");
    await lstat(nodeModules);

    // pnpm deploy leaves a workspace self-link in its virtual-store index. It
    // points back to the build checkout and is not a runtime dependency.
    const workspaceSelfLink = path.join(
      nodeModules,
      ".pnpm/node_modules/@workspace/api-server",
    );
    try {
      const selfLinkInfo = await lstat(workspaceSelfLink);
      if (selfLinkInfo.isSymbolicLink()) {
        const selfLinkTarget = await realpath(workspaceSelfLink);
        if (selfLinkTarget !== path.resolve(root, "artifacts/api-server")) {
          throw new Error("API runtime package contains an unexpected workspace link.");
        }
        await rm(workspaceSelfLink);
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    await assertNoEscapingSymlinks(nodeModules);
    await smokeTestSharp(packageRoot);

    run("tar", [
      "--exclude=node_modules/.modules.yaml",
      "--exclude=node_modules/.pnpm-workspace-state-v1.json",
      "-czf", temporaryArchive,
      "-C", packageRoot,
      "node_modules",
    ], { cwd: root });

    const listing = run("tar", ["-tzf", temporaryArchive], { cwd: root });
    const entryCount = assertSafeArchiveListing(listing);
    await mkdir(extractedRoot, { recursive: true });
    run("tar", ["-xzf", temporaryArchive, "-C", extractedRoot], { cwd: root });
    await smokeTestSharp(extractedRoot);

    const archiveInfo = await stat(temporaryArchive);
    if (archiveInfo.size > MAX_ARCHIVE_BYTES) {
      throw new Error("API runtime dependency archive exceeds the safe GitHub file-size limit.");
    }
    const archiveBytes = await readFile(temporaryArchive);
    const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
    await rename(temporaryArchive, output);
    return {
      archive: path.relative(root, output).split(path.sep).join("/"),
      bytes: archiveInfo.size,
      sizeBytes: archiveInfo.size,
      sha256,
      platform: `${process.platform}-${process.arch}`,
      node: process.version,
      entries: entryCount,
      externalRuntimePackages: ["sharp", "@swc/helpers"],
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
    await rm(outputTempDirectory, { recursive: true, force: true });
  }
}
