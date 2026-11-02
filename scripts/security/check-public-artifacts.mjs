import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanText } from "./check-secrets.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoots = [
  "artifacts/sendflow/dist/public",
  "artifacts/sendflow/android/app/src/main/assets",
  "artifacts/sendflow/android/app/build/outputs",
  "artifacts/sendflow/android/app/build/intermediates/assets",
];
const textExtensions = new Set([
  ".cjs", ".css", ".gradle", ".html", ".java", ".js", ".json", ".kt",
  ".map", ".mjs", ".pro", ".properties", ".txt", ".xml",
]);
const archiveExtensions = new Set([".apk", ".aab"]);
const archiveEntryExtensions = new Set([
  ...textExtensions, ".arsc", ".dex",
]);

function isScannableTextFile(file) {
  return textExtensions.has(path.extname(file).toLowerCase());
}

function scanContent(file, content) {
  const text = Buffer.isBuffer(content)
    ? content.toString("utf8")
    : content;
  return scanText(file, text);
}

export function scanPublicArtifactText(file, content) {
  return scanContent(file, content);
}

function scanArchive(archivePath) {
  let entries;
  try {
    entries = execFileSync("unzip", ["-Z1", archivePath], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    throw new Error("An Android package could not be inspected");
  }

  const findings = [];
  let inspected = 0;
  for (const entry of entries) {
    if (!archiveEntryExtensions.has(path.extname(entry).toLowerCase())) continue;
    let content;
    try {
      content = execFileSync("unzip", ["-p", archivePath, entry], {
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      throw new Error("An Android package entry could not be inspected");
    }
    inspected++;
    findings.push(...scanContent(`${archivePath}!${entry}`, content));
  }
  return { inspected, findings };
}

function walkPublicTree(relativeRoot) {
  const root = path.join(workspaceRoot, relativeRoot);
  if (!existsSync(root)) return { inspected: 0, findings: [] };

  const findings = [];
  let inspected = 0;
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = path.relative(workspaceRoot, fullPath);
      const extension = path.extname(entry.name).toLowerCase();
      if (archiveExtensions.has(extension)) {
        const result = scanArchive(fullPath);
        inspected += result.inspected;
        findings.push(...result.findings);
      } else if (isScannableTextFile(fullPath)) {
        inspected++;
        findings.push(...scanContent(relativePath, readFileSync(fullPath)));
      }
    }
  };

  visit(root);
  return { inspected, findings };
}

export function checkPublicArtifacts() {
  const findings = [];
  let inspected = 0;
  const roots = [];
  for (const relativeRoot of publicRoots) {
    const root = path.join(workspaceRoot, relativeRoot);
    if (!existsSync(root)) continue;
    roots.push(relativeRoot);
    const result = walkPublicTree(relativeRoot);
    inspected += result.inspected;
    findings.push(...result.findings);
  }
  return { roots, inspected, findings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { roots, inspected, findings } = checkPublicArtifacts();
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line} [${finding.rule}] (value hidden)`);
    }
    console.log(
      `Public-artifact secret check: ${inspected} files in ${roots.length} artifact location(s), ${findings.length} finding(s).`,
    );
    process.exitCode = findings.length ? 1 : 0;
  } catch {
    console.error("Public-artifact secret check could not inspect all configured artifacts.");
    process.exitCode = 2;
  }
}
