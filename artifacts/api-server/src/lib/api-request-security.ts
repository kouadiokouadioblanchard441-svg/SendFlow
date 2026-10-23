import type { RequestHandler } from "express";
import { normalizeHttpOrigin } from "./origin-policy.ts";
import { isValidCsrfRequest, issueCsrfToken } from "./csrf-protection.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cookie sessions use SameSite=None for the embedded preview. CORS alone does
 * not reject cross-origin simple requests: enforce exact Origin and a
 * session-bound synchronizer token before parsing bodies, looking up sessions,
 * consuming quotas, or running business handlers.
 */
export function apiRequestSecurity(allowedOrigins: ReadonlySet<string>): RequestHandler {
  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, private");
    if (SAFE_METHODS.has(req.method)) {
      if (req.method === "GET") {
        try {
          issueCsrfToken(req, res);
        } catch {
          req.log?.error("CSRF token issuance is unavailable");
          if (req.path === "/auth/session") {
            res.status(503).json({ error: "Request security is temporarily unavailable" });
            return;
          }
        }
      }
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
    const csrfToken = req.get("x-csrf-token");
    if (!isValidCsrfRequest(req, csrfToken)) {
      res.status(403).json({
        error: "CSRF token missing or invalid",
        code: "csrf_token_invalid",
      });
      return;
    }
    next();
  };
}
