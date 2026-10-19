import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function collectRuntimeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectRuntimeFiles(fullPath);
      if (
        entry.isFile()
        && entry.name.endsWith(".ts")
        && !entry.name.endsWith(".test.ts")
        && !entry.name.endsWith(".d.ts")
      ) {
        return [fullPath];
      }
      return [];
    }),
  );
  return nestedFiles.flat();
}

test("API runtime keeps SQL behind parameterized Drizzle statements", async () => {
  const runtimeFiles = await Promise.all(
    ["routes", "lib"].map((directory) =>
      collectRuntimeFiles(path.join(sourceDirectory, directory)),
    ),
  ).then((groups) => groups.flat());

  const violations = [];

  for (const filePath of runtimeFiles) {
    const source = await readFile(filePath, "utf8");
    const executableSource = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    const relativePath = path.relative(sourceDirectory, filePath);

    if (/from\s+["'](?:pg|node-postgres)["']/.test(executableSource)) {
      violations.push(`${relativePath}: direct PostgreSQL driver import`);
    }
    if (/\b(?:pool|client)\.query\s*\(/.test(executableSource)) {
      violations.push(`${relativePath}: direct PostgreSQL query call`);
    }
    if (/\bsql\.raw\s*\(/.test(executableSource)) {
      violations.push(`${relativePath}: raw Drizzle SQL fragment`);
    }

    for (const match of executableSource.matchAll(/\b(?:db|tx)\.execute\s*\(/g)) {
      const statementStart = executableSource.slice(match.index + match[0].length);
      if (!/^\s*sql\s*`/.test(statementStart)) {
        violations.push(
          `${relativePath}: execute() must receive a parameterized sql template`,
        );
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "SQL injection boundary violations found:",
      ...violations.map((violation) => `- ${violation}`),
    ].join("\n"),
  );
});
