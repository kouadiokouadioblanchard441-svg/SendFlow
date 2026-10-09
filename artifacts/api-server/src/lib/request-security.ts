import { createHmac } from "node:crypto";
import type { Request } from "express";
import { getAllowedOrigins, normalizeHttpOrigin } from "./origin-policy";

function fingerprintKey() {
  const key = process.env.SESSION_SECRET?.trim();
  if (!key) throw new Error("Session fingerprinting is not configured");
  return key;
}

export function fingerprint(value: string) {
  return createHmac("sha256", fingerprintKey()).update(value).digest("hex");
}

export function requesterAddress(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function isTrustedOrigin(req: Request) {
  const origin = normalizeHttpOrigin(req.get("origin"));
  return origin !== null && getAllowedOrigins(process.env).has(origin);
}