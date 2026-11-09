import type { RequestHandler } from "express";
import { hasValidAdminGateCookie, isAdminApiRequestPath } from "@workspace/admin-gate";

const NOT_FOUND_BODY = "404 Not Found";

/**
 * The public login UI is served by the web artifact, but the API artifact is
 * independently reachable. Keep the same server-validated gate on every
 * administrative API path before logging, CORS, or route handling.
 */
export const requireAdminSecretGate: RequestHandler = (req, res, next) => {
  if (!isAdminApiRequestPath(req.originalUrl)) {
    next();
    return;
  }

  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Vary", "Cookie");
  if (!hasValidAdminGateCookie(req.headers.cookie, process.env)) {
    res.status(404).type("text/plain").send(NOT_FOUND_BODY);
    return;
  }
  next();
};
