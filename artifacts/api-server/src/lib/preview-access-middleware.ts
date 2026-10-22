import type { RequestHandler } from "express";
import { getCustomerSession } from "./customer-session";
import { isSharedNeonPreview, isViewerRouteCandidate, normalizeRequestPath } from "./shared-neon-preview-guard";

export const enforcePreviewAccountAccess: RequestHandler = async (req, res, next) => {
  if (!isSharedNeonPreview() || !isViewerRouteCandidate(req.method, req.originalUrl)) {
    next();
    return;
  }
  res.setHeader("Cache-Control", "no-store, private");
  // Password verification, SQL grant restriction and rate limiting live in
  // the existing sign-in controller. No other unauthenticated exception.
  if (req.method === "POST" && normalizeRequestPath(req.originalUrl) === "/api/auth/sign-in") {
    next();
    return;
  }
  try {
    if (!await getCustomerSession(req, { touchLastSeen: false })) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  } catch {
    req.log.warn("Preview account authorization unavailable");
    res.status(503).json({ error: "L’accès de visualisation est momentanément indisponible." });
  }
};
