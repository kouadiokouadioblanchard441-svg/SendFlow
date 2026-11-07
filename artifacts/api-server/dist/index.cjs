"use strict";
// Plesk CommonJS adapter: keep application logic in the existing ESM bundle.
if (process.env.NODE_ENV !== "production") {
  console.error("Plesk startup requires NODE_ENV=production.");
  process.exitCode = 1;
} else {
  import("./index.mjs").catch(() => {
    // Never print an exception that might contain credentials or private data.
    console.error("Plesk application startup failed. Check private configuration and application logs.");
    process.exitCode = 1;
  });
}
