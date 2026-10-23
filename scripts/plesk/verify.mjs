import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export function commonJsLauncher(target) {
  if (!["./index.mjs", "./server/index.mjs"].includes(target)) {
    throw new Error("Unsupported Plesk entry point");
  }
  return `"use strict";
// Plesk CommonJS adapter: keep application logic in the existing ESM bundle.
if (process.env.NODE_ENV !== "production") {
  console.error("Plesk startup requires NODE_ENV=production.");
  process.exitCode = 1;
} else {
  import(${JSON.stringify(target)}).catch(() => {
    // Never print an exception that might contain credentials or private data.
    console.error("Plesk application startup failed. Check private configuration and application logs.");
    process.exitCode = 1;
  });
}
`;
}

async function inventory(root, current = root) {
  const files = [];
  for (const name of (await readdir(current)).sort()) {
    const filename = path.join(current, name);
    const info = await lstat(filename);
    if (info.isSymbolicLink()) throw new Error("Release must not contain symlinks");
    if ((info.mode & 0o002) !== 0) throw new Error("Release contains world-writable files");
    if (name.startsWith(".env") || /\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(name)) {
      throw new Error("Release contains a forbidden configuration or key file");
    }
    if (info.isDirectory()) {
      files.push(...await inventory(root, filename));
    } else if (info.isFile()) {
      const relative = path.relative(root, filename).split(path.sep).join("/");
      if (relative === "plesk-manifest.json") continue;
      const content = await readFile(filename);
      files.push({
        path: relative,
        bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
      });
    } else {
      throw new Error("Release contains an unsupported file type");
    }
  }
  return files;
}

export async function verifyDistribution(root, service) {
  if (!["web", "api"].includes(service)) throw new Error("Unknown Plesk service");
  const files = await inventory(root);
  const names = new Set(files.map((file) => file.path));
  const entry = service === "web" ? "server/index.mjs" : "index.mjs";
  for (const required of ["index.cjs", entry, ...(service === "web" ? ["public/index.html"] : [])]) {
    if (!names.has(required)) throw new Error(`Missing release entry: ${required}`);
  }
  if (service === "web") {
    for (const file of files.filter((file) => file.path.startsWith("public/"))) {
      if (file.path.endsWith(".map")) throw new Error("Public source maps are not permitted in the Plesk release");
      if (/\.(?:html|js|css|json|svg|webmanifest)$/.test(file.path)) {
        const text = await readFile(path.join(root, file.path), "utf8");
        if (/\b(?:NEON_DATABASE_URL_(?:PRODUCTION|PREVIEW)|FEEXPAY_(?:API_KEY|SHOP_ID|SANDBOX_API_KEY|SANDBOX_SHOP_ID)|DIDIT_(?:API_KEY|WEBHOOK_SECRET)|ESMS_API_KEY|SESSION_SECRET|CUSTOMER_PII_ENCRYPTION_KEY|SENDFLOW_(?:VIEWER_PASSWORD|VIEWER_PHONE|PAYMENT_TEST_PHONE))\b/.test(text)) {
          throw new Error(`Server-secret variable name found in public output: ${file.path}`);
        }
      }
    }
    const html = await readFile(path.join(root, "public/index.html"), "utf8");
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
      const url = new URL(match[1], "https://release.invalid/");
      if (url.origin !== "https://release.invalid") continue;
      const relative = `public${decodeURIComponent(url.pathname)}`;
      if (!names.has(relative)) throw new Error(`Missing HTML asset: ${relative}`);
    }
  }
  return { service, startupFile: "index.cjs", esmEntry: entry, files };
}
