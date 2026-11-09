import { access, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const adminDirectory = path.resolve(scriptDirectory, "../dist/admin");
const generatedEntry = path.join(adminDirectory, "admin.html");
const expectedEntry = path.join(adminDirectory, "index.html");

try {
  await access(generatedEntry);
} catch {
  throw new Error("The private interface build did not produce its HTML entry.");
}

await rename(generatedEntry, expectedEntry);
