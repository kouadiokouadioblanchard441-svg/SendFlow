import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const textExtensions = new Set([".html", ".js", ".css", ".json", ".map", ".txt"]);

async function walk(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

export async function assertNoAdminGateSecretsInArtifacts(
  directories,
  secrets = [process.env.ADMIN_SECRET_PATH, process.env.ADMIN_SECRET_TOKEN],
) {
  const candidates = [...new Set(secrets.filter((value) => typeof value === "string" && value.length >= 16))];
  if (!candidates.length) return;

  for (const directory of directories) {
    for (const file of await walk(directory)) {
      const contents = await readFile(file);
      if (candidates.some((secret) => contents.includes(Buffer.from(secret)))) {
        // Do not include the value or a matching excerpt in the build error.
        throw new Error("Administrator access secrets were detected in a build artifact.");
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const sendflowRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../artifacts/sendflow");
  await assertNoAdminGateSecretsInArtifacts([
    path.join(sendflowRoot, "dist/public"),
    path.join(sendflowRoot, "dist/admin"),
  ]);
}
