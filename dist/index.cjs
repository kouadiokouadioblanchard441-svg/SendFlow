"use strict";
// Plesk CommonJS adapter: keep application logic in the existing ESM bundle.
function safeConfigurationHint(error) {
  let message = "";
  try {
    message = error instanceof Error ? error.message : "";
  } catch {
    return "";
  }
  if (message.startsWith("TRUST_PROXY_HOPS")) {
    return "Check the TRUST_PROXY_HOPS environment variable.";
  }
  if (message.startsWith("CORS_ALLOWED_ORIGINS")) {
    return "Check the CORS_ALLOWED_ORIGINS environment variable.";
  }
  if (message.startsWith("SENDFLOW_DATABASE_TARGET")) {
    return "Check SENDFLOW_DATABASE_TARGET and NODE_ENV.";
  }
  if (message.startsWith("SUPABASE_DATABASE_URL is required")) {
    return "The production database URL environment variable is missing.";
  }
  if (message.startsWith("DATABASE_URL is required for the Plesk production database")) {
    return "The production database URL environment variable is missing.";
  }
  if (message.startsWith("DATABASE_CA_CERT is required for the Plesk production database")) {
    return "The DATABASE_CA_CERT environment variable is missing.";
  }
  if (message.startsWith("PORT")) {
    return "Check that Plesk provides a valid PORT to this Node.js application.";
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
  console.error("Plesk startup requires NODE_ENV=production.");
  process.exitCode = 1;
} else {
  import("./server/index.mjs").catch((error) => {
    // Never print an exception that might contain credentials or private data.
    console.error("Plesk application startup failed. Check private configuration and application logs.");
    console.error("Plesk startup failure details: " + safeFailureLabel(error));
    const hint = safeConfigurationHint(error);
    if (hint) console.error("Plesk configuration check: " + hint);
    process.exitCode = 1;
  });
}
