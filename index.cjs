"use strict";
// Plesk CommonJS adapter: keep application logic in the existing ESM bundle.
const PLESK_SERVICE = "site";
function safeFailureCategory(error) {
  try {
    let current = error;
    for (
      let depth = 0;
      depth < 3 && current && (typeof current === "object" || typeof current === "function");
      depth += 1
    ) {
      const message = typeof current.message === "string" ? current.message : "";
      if (message.startsWith("TRUST_PROXY_HOPS")) return "INVALID_TRUST_PROXY_HOPS";
      if (message.startsWith("CORS_ALLOWED_ORIGINS")) return "INVALID_CORS_ALLOWED_ORIGINS";
      if (message.startsWith("SENDFLOW_DATABASE_TARGET")) return "INVALID_DATABASE_TARGET";
      if (
        message.startsWith("SUPABASE_DATABASE_URL is required")
        || message.startsWith("DATABASE_URL is required for the Plesk production database")
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
  if (PLESK_SERVICE === "API") required.push("CORS_ALLOWED_ORIGINS");
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SUPABASE_DATABASE_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
      missing.push("SUPABASE_DATABASE_URL or DATABASE_URL");
    }
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
  import("./dist/server/index.mjs").catch((error) => {
    // Never print an exception that might contain credentials or private data.
    console.error("Plesk " + PLESK_SERVICE + " application startup failed. Check private configuration and application logs.");
    console.error("Plesk " + PLESK_SERVICE + " startup failure details: " + safeFailureLabel(error));
    console.error("Plesk " + PLESK_SERVICE + " startup failure category: " + safeFailureCategory(error));
    const missingEnvironmentNames = safeMissingEnvironmentNames();
    if (missingEnvironmentNames.length) {
      console.error("Plesk " + PLESK_SERVICE + " runtime variables unset: " + missingEnvironmentNames.join(", "));
    }
    const hint = safeConfigurationHint(error);
    if (hint) console.error("Plesk " + PLESK_SERVICE + " configuration check: " + hint);
    process.exitCode = 1;
  });
}
