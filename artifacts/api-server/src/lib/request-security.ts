import { createHmac } from "node:crypto";
import type { Request } from "express";

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
  const origin = req.get("origin");
  if (!origin) return false;

  const configuredOrigins = [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.REPLIT_DOMAINS,
    process.env.REPLIT_DEV_DOMAIN,
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`));

  return configuredOrigins.includes(origin.replace(/\/+$/, ""));
}