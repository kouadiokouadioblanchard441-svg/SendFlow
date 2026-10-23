import type { RequestHandler } from "express";
import { normalizeHttpOrigin } from "./origin-policy.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie sessions use SameSite=None for the embedded preview. CORS alone does
 * not reject cross-origin simple requests: enforce origin before body parsing,
 * session lookups, quotas or business handlers can have side effects.
 */
export function apiRequestSecurity(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, private");
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // This exact machine-to-machine endpoint authenticates the signed payload
    // in its handler. Never exempt an entire /webhooks prefix.
    if (req.method === "POST" && req.path === "/webhooks/didit") {
      next();
      return;
    }

    const origin = normalizeHttpOrigin(req.get("origin"));
    if (!origin || !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Request origin not allowed" });
      return;
    }
    next();
  };
}
