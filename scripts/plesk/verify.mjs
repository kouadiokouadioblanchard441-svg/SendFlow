import { createHash } from "node:crypto";
import { cp, lstat, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

export function commonJsLauncher(target) {
  if (!["./index.mjs", "./server/index.mjs", "./dist/server/index.mjs"].includes(target)) {
    throw new Error("Unsupported Plesk entry point");
  }
  return `"use strict";
// Plesk CommonJS adapter: keep application logic in the existing ESM bundle.
const PLESK_SERVICE = ${JSON.stringify(target === "./index.mjs" ? "API" : "site")};
const path = require("node:path");
const PLESK_APPLICATION_ROOT = path.resolve(
  __dirname,
  ${JSON.stringify(target === "./dist/server/index.mjs" ? "./dist" : ".")},
);
function safeFailureCategory(error) {
  try {
    let current = error;
    for (
      let depth = 0;
      depth < 3 && current && (typeof current === "object" || typeof current === "function");
      depth += 1
    ) {
      const code = typeof current.code === "string" ? current.code : "";
      if (code === "ERR_MODULE_NOT_FOUND" || code === "ERR_REQUIRE_ESM") {
        return "MISSING_MODULE";
      }
      const message = typeof current.message === "string" ? current.message : "";
      if (message.startsWith("TRUST_PROXY_HOPS")) return "INVALID_TRUST_PROXY_HOPS";
      if (message.startsWith("CORS_ALLOWED_ORIGINS")) return "INVALID_CORS_ALLOWED_ORIGINS";
      if (message.startsWith("SENDFLOW_DATABASE_TARGET")) return "INVALID_DATABASE_TARGET";
      if (
        message.startsWith("SUPABASE_DATABASE_URL is required")
      ) return "MISSING_DATABASE_URL";
      if (message.startsWith("DATABASE_CA_CERT is required")) return "MISSING_DATABASE_CA_CERT";
      if (message.startsWith("External database configuration is invalid.")) return "INVALID_DATABASE_URL";
      if (
        message.startsWith("Database connection requires verified TLS.")
        || message.startsWith("The shared external database requires verified TLS.")
      ) return "DATABASE_TLS_CONFIGURATION";
      current = current.cause;
    }
  } catch {}
  return "UNCLASSIFIED";
}
function safeMissingEnvironmentNames() {
  const required = ["NODE_ENV", "SENDFLOW_DATABASE_TARGET", "TRUST_PROXY_HOPS"];
  if (PLESK_SERVICE === "API" || PLESK_SERVICE === "site") {
    required.push("CORS_ALLOWED_ORIGINS");
    required.push("TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY");
  }
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SUPABASE_DATABASE_URL?.trim()) missing.push("SUPABASE_DATABASE_URL");
    if (!process.env.DATABASE_CA_CERT?.trim()) missing.push("DATABASE_CA_CERT");
  }
  return missing;
}
function safeConfigurationHint(error) {
  const category = safeFailureCategory(error);
  if (category === "INVALID_TRUST_PROXY_HOPS") {
    return "Check the TRUST_PROXY_HOPS environment variable.";
  }
  if (category === "INVALID_CORS_ALLOWED_ORIGINS") {
    return "Check the CORS_ALLOWED_ORIGINS environment variable.";
  }
  if (category === "INVALID_DATABASE_TARGET") {
    return "Check SENDFLOW_DATABASE_TARGET and NODE_ENV.";
  }
  if (category === "MISSING_DATABASE_URL") {
    return "The production database URL environment variable is missing.";
  }
  if (category === "MISSING_DATABASE_CA_CERT") {
    return "The DATABASE_CA_CERT environment variable is missing.";
  }
  if (category === "INVALID_DATABASE_URL") {
    return "Check the production database URL format; its value is never logged.";
  }
  if (category === "DATABASE_TLS_CONFIGURATION") {
    return "Check that the production database connection uses verified TLS.";
  }
  return "";
}
function safeMissingModuleReference(error) {
  try {
    let current = error;
    for (
      let depth = 0;
      depth < 3 && current && (typeof current === "object" || typeof current === "function");
      depth += 1
    ) {
      const code = typeof current.code === "string" ? current.code : "";
      if (code === "ERR_MODULE_NOT_FOUND" || code === "ERR_REQUIRE_ESM") {
        const message = typeof current.message === "string" ? current.message : "";
        const packageMatch = message.match(/Cannot find package ['"]([^'"]+)['"]/i);
        if (
          packageMatch
          && /^(@[A-Za-z0-9._-]+\\/)?[A-Za-z0-9._-]+(?:\\/[A-Za-z0-9._-]+)*$/.test(packageMatch[1])
        ) {
          return "package " + packageMatch[1];
        }
        const referenceMatch = message.match(
          /(?:Cannot find module |require\\(\\) of ES Module )['"]?([^\\s'"]+)['"]?/i,
        );
        if (referenceMatch) {
          const reference = referenceMatch[1].replace(/\\\\/g, "/");
          if (path.isAbsolute(reference)) {
            const relative = path.relative(PLESK_APPLICATION_ROOT, reference).replace(/\\\\/g, "/");
            if (
              relative
              && relative !== ".."
              && !relative.startsWith("../")
              && !path.isAbsolute(relative)
              && /^[A-Za-z0-9@._+/-]+$/.test(relative)
            ) {
              return "file " + relative;
            }
            return "external file";
          }
          if (/^(?:\\.\\.?\\/)?[A-Za-z0-9@._+/-]+$/.test(reference)) {
            return "module " + reference;
          }
        }
        return "unknown";
      }
      current = current.cause;
    }
  } catch {}
  return "unknown";
}
console.log("Plesk " + PLESK_SERVICE + " Node version: " + process.version);
console.log("Plesk " + PLESK_SERVICE + " application root: " + PLESK_APPLICATION_ROOT);
function safeFailureLabel(error) {
  let fallbackName = "";
  try {
    let current = error;
    for (
      let depth = 0;
      depth < 3 && current && (typeof current === "object" || typeof current === "function");
      depth += 1
    ) {
      const name = typeof current.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(current.name)
        ? current.name
        : "";
      if (!fallbackName && name) fallbackName = name;
      const code = typeof current.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(current.code)
        ? current.code
        : "";
      if (code) return (name || fallbackName || "Error") + "/" + code;
      current = current.cause;
    }
  } catch {}
  if (fallbackName) return fallbackName;
  if (error === null) return "NullRejection";
  if (typeof error === "string") return "NonErrorString";
  if (typeof error === "object") return "NonErrorObject";
  return "NonErrorValue";
}
if (process.env.NODE_ENV !== "production") {
  console.error("Plesk " + PLESK_SERVICE + " startup requires NODE_ENV=production.");
  process.exitCode = 1;
} else {
  import(${JSON.stringify(target)}).catch((error) => {
    // Never print an exception that might contain credentials or private data.
    console.error("Plesk " + PLESK_SERVICE + " application startup failed. Check private configuration and application logs.");
    console.error("Plesk " + PLESK_SERVICE + " startup failure details: " + safeFailureLabel(error));
    console.error("Plesk " + PLESK_SERVICE + " startup failure category: " + safeFailureCategory(error));
    if (safeFailureCategory(error) === "MISSING_MODULE") {
      console.error(
        "Plesk " + PLESK_SERVICE + " missing module reference: "
          + safeMissingModuleReference(error),
      );
    }
    const missingEnvironmentNames = safeMissingEnvironmentNames();
    if (missingEnvironmentNames.length) {
      console.error("Plesk " + PLESK_SERVICE + " runtime variables unset: " + missingEnvironmentNames.join(", "));
    }
    const hint = safeConfigurationHint(error);
    if (hint) console.error("Plesk " + PLESK_SERVICE + " configuration check: " + hint);
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
    if (name === ".git") throw new Error("Release must not contain Git metadata");
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
  for (const required of [
    "index.cjs",
    entry,
    ...(service === "web"
      ? [
          "public/index.html",
          "admin/index.html",
          "server/api/embedded.mjs",
          "dist/pino-file.mjs",
          "dist/pino-pretty.mjs",
          "dist/pino-worker.mjs",
          "dist/thread-stream-worker.mjs",
          "plesk-runtime-dependencies.tar.gz",
        ]
      : []),
  ]) {
    if (!names.has(required)) throw new Error(`Missing release entry: ${required}`);
  }
  if (files.some((file) => file.path.endsWith(".map"))) {
    throw new Error("Release source maps are not included in the Plesk package");
  }
  if (service === "api") {
    const apiBundle = await readFile(path.join(root, entry), "utf8");
    if (/const outputDir\s*=\s*["'](?:\/|[A-Za-z]:[\\/])/.test(apiBundle)) {
      throw new Error("API release contains a machine-specific absolute Pino worker path");
    }
  }
  if (service === "web") {
    const embeddedApi = await readFile(
      path.join(root, "server/api/embedded.mjs"),
      "utf8",
    );
    if (/const outputDir\s*=\s*["'](?:\/|[A-Za-z]:[\\/])/.test(embeddedApi)) {
      throw new Error("Integrated API bundle contains a machine-specific absolute Pino worker path");
    }
    for (const file of files.filter((file) => /^(?:public|admin)\//.test(file.path))) {
      if (/\.(?:html|js|css|json|svg|webmanifest)$/.test(file.path)) {
        const text = await readFile(path.join(root, file.path), "utf8");
        if (/\b(?:SUPABASE_DATABASE_URL|DATABASE_URL|FEEXPAY_(?:API_KEY|SHOP_ID|SANDBOX_API_KEY|SANDBOX_SHOP_ID)|DIDIT_(?:API_KEY|WEBHOOK_SECRET)|ESMS_API_KEY|SESSION_SECRET|CUSTOMER_PII_ENCRYPTION_KEY|SENDFLOW_(?:VIEWER_PASSWORD|VIEWER_PHONE|PAYMENT_TEST_PHONE))\b/.test(text)) {
          throw new Error(`Server-secret variable name found in browser output: ${file.path}`);
        }
        if (file.path.startsWith("public/") &&
          /admin|administration|administrateur|administratrice|administrator|sendflow-app-surface/i.test(text)) {
          throw new Error(`Private interface marker found in public output: ${file.path}`);
        }
      }
    }
    for (const surface of ["public", "admin"]) {
      const html = await readFile(path.join(root, surface, "index.html"), "utf8");
      for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
        const url = new URL(match[1], "https://release.invalid/");
        if (url.origin !== "https://release.invalid") continue;
        const pathname = decodeURIComponent(url.pathname);
        const privateAssetPrefix = "/__sendflow_private_bundle__/";
        const relative = surface === "admin" && pathname.startsWith(privateAssetPrefix)
          ? `admin/${pathname.slice(privateAssetPrefix.length)}`
          : `${surface}${pathname}`;
        if (!names.has(relative)) throw new Error(`Missing HTML asset: ${relative}`);
      }
    }
  }
  return { service, startupFile: "index.cjs", esmEntry: entry, files };
}

export async function stagePleskWebDistribution(source, target) {
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true });
  return verifyDistribution(target, "web");
}
