import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { webcrypto } from "node:crypto";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";
import { isTrustedOrigin, requesterAddress } from "./request-security";

type CloudflareJwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type CloudflareJwksCache = {
  issuer: string;
  expiresAt: number;
  keys: CloudflareJwk[];
};

let jwksCache: CloudflareJwksCache | null = null;

function normalizedIp(value: string): string | null {
  const candidate = value.trim().replace(/^\[|\]$/gu, "");
  const ipv4Mapped = candidate.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu)?.[1];
  const normalized = ipv4Mapped ?? candidate;
  return isIP(normalized) ? normalized.toLowerCase() : null;
}

export function isAdminClientIpAllowed(
  address: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = environment.SENDFLOW_ADMIN_ALLOWED_IPS?.trim();
  if (!configured) return true;
  const entries = configured.split(",").map(normalizedIp);
  const requested = normalizedIp(address);
  return Boolean(requested && entries.length && entries.every(Boolean) && entries.includes(requested));
}

function cloudflareIssuer(environment: NodeJS.ProcessEnv): string | null {
  const value = environment.SENDFLOW_CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.port
      || url.pathname !== "/"
      || url.search
      || url.hash
      || !url.hostname.endsWith(".cloudflareaccess.com")
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function loadCloudflareJwks(issuer: string): Promise<CloudflareJwk[]> {
  if (jwksCache && jwksCache.issuer === issuer && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error("Cloudflare Access key service unavailable");
  const body = await response.json() as { keys?: unknown };
  if (!Array.isArray(body.keys)) throw new Error("Cloudflare Access key response invalid");
  const keys = body.keys.filter((key): key is CloudflareJwk =>
    Boolean(key && typeof key === "object" && (key as CloudflareJwk).kty === "RSA"
      && typeof (key as CloudflareJwk).kid === "string"),
  );
  if (keys.length === 0) throw new Error("Cloudflare Access keys unavailable");
  jwksCache = { issuer, expiresAt: Date.now() + 5 * 60_000, keys };
  return keys;
}

function decodeSegment<T>(segment: string): T {
  if (!/^[A-Za-z0-9_-]+$/u.test(segment) || segment.length > 16_384) {
    throw new Error("Malformed Cloudflare Access assertion");
  }
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

async function verifyCloudflareAssertion(req: Request): Promise<boolean> {
  const issuer = cloudflareIssuer(process.env);
  const audience = process.env.SENDFLOW_CLOUDFLARE_ACCESS_AUD?.trim();
  const token = req.get("cf-access-jwt-assertion");
  if (!issuer || !audience || !token || token.length > 24_000) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = decodeSegment<{ alg?: string; kid?: string }>(parts[0]!);
    const claims = decodeSegment<{
      iss?: string;
      aud?: string | string[];
      sub?: string;
      exp?: number;
      nbf?: number;
    }>(parts[1]!);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return false;
    const keys = await loadCloudflareJwks(issuer);
    const jwk = keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === "RS256"));
    if (!jwk) return false;
    const key = createPublicKey({ key: jwk as webcrypto.JsonWebKey, format: "jwk" });
    const validSignature = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2]!, "base64url"),
    );
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return validSignature
      && claims.iss === issuer
      && audiences.includes(audience)
      && typeof claims.sub === "string"
      && claims.sub.length > 0
      && typeof claims.exp === "number"
      && claims.exp > now
      && (claims.nbf === undefined || (typeof claims.nbf === "number" && claims.nbf <= now + 30));
  } catch {
    return false;
  }
}

export const adminNetworkGuard: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const origin = req.get("origin");
  const sameOriginFetch = req.get("sec-fetch-site") === "same-origin";
  if (origin ? !isTrustedOrigin(req) : !sameOriginFetch) {
    res.status(403).json({ error: "Origine non autorisée." });
    return;
  }
  if (!isAdminClientIpAllowed(requesterAddress(req))) {
    res.status(403).json({ error: "Accès réseau non autorisé." });
    return;
  }

  if (process.env.SENDFLOW_ADMIN_REQUIRE_CLOUDFLARE_ACCESS === "true") {
    if (!cloudflareIssuer(process.env) || !process.env.SENDFLOW_CLOUDFLARE_ACCESS_AUD?.trim()) {
      req.log.error("Cloudflare Access assertion verification is not configured");
      res.status(503).json({ error: "La vérification réseau est indisponible." });
      return;
    }
    void verifyCloudflareAssertion(req).then((valid) => {
      if (!valid) {
        res.status(403).json({ error: "Accès réseau non autorisé." });
        return;
      }
      next();
    }).catch((error: unknown) => {
      req.log.error({ err: error }, "Cloudflare Access assertion verification failed");
      if (!res.headersSent) res.status(503).json({ error: "La vérification réseau est indisponible." });
    });
    return;
  }
  next();
};
