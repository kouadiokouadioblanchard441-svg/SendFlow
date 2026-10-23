import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

test("API runtime uses parameterized Drizzle or audited literal PostgreSQL statements", async () => {
  const runtimeFiles = await Promise.all(
    ["routes", "lib", "services", "data"].map((directory) =>
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
    const syntax = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === "query"
        && ["pool", "client"].includes(node.expression.expression.getText(syntax))) {
        // Network defense needs explicit connection-level transaction/timeout
        // control. Permit that one boundary, never dynamic query text.
        const [query, values] = node.arguments;
        if (relativePath !== "services/network-defense.ts"
          || !query || !ts.isStringLiteralLike(query)) {
          violations.push(`${relativePath}: unapproved or dynamic PostgreSQL query`);
        } else {
          const placeholders = [...query.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
          const required = Math.max(0, ...placeholders);
          if ((required && (!values || !ts.isArrayLiteralExpression(values) || values.elements.length !== required))
            || (!required && values)) {
            violations.push(`${relativePath}: PostgreSQL parameter bindings do not match literal query`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
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
