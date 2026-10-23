import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";

export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const CSRF_TOKEN_TTL_MS = 10 * 60 * 1000;
export const ANONYMOUS_CSRF_COOKIE = "__Host-sendflow_csrf";

const CUSTOMER_SESSION_COOKIE = "__Host-sendflow_session";
const ADMIN_SESSION_COOKIE = "__Host-sendflow_admin";
const OPAQUE_COOKIE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type CsrfPayload = {
  version: 1;
  expiresAt: number;
  binding: string;
  nonce: string;
};

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return OPAQUE_COOKIE_PATTERN.test(value) ? value : null;
}

function authenticatedBinding(req: Request): string | null {
  const customerSession = readCookie(req.headers.cookie, CUSTOMER_SESSION_COOKIE);
  const adminSession = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (customerSession || adminSession) {
    return `authenticated:v1:${customerSession ?? ""}:${adminSession ?? ""}`;
  }
  return null;
}

function requestBinding(req: Request): string | null {
  const authenticated = authenticatedBinding(req);
  if (authenticated) return authenticated;
  const anonymousSession = readCookie(req.headers.cookie, ANONYMOUS_CSRF_COOKIE);
  return anonymousSession ? `anonymous:v1:${anonymousSession}` : null;
}

function signingKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("CSRF signing is not configured");
  }

  // Domain-separate CSRF signing from other uses of SESSION_SECRET.
  return createHmac("sha256", secret)
    .update("sendflow:csrf-signing-key:v1")
    .digest();
}

function bindingDigest(binding: string): string {
  return createHash("sha256").update(binding).digest("base64url");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", signingKey())
    .update(`sendflow:csrf-token:v1:${encodedPayload}`)
    .digest("base64url");
}

export function createCsrfToken(binding: string, now = Date.now()): string {
  const payload: CsrfPayload = {
    version: 1,
    expiresAt: now + CSRF_TOKEN_TTL_MS,
    binding: bindingDigest(binding),
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyCsrfToken(
  token: string | undefined,
  binding: string | null,
  now = Date.now(),
): boolean {
  if (!token || token.length > 2048 || !binding) return false;
  const [encodedPayload, providedSignature, ...extra] = token.split(".");
  if (
    !encodedPayload
    || !providedSignature
    || extra.length > 0
    || !SIGNATURE_PATTERN.test(providedSignature)
    || Buffer.from(encodedPayload, "base64url").toString("base64url") !== encodedPayload
  ) {
    return false;
  }

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return false;
  }
  const expectedSignatureBytes = Buffer.from(expectedSignature, "base64url");
  const providedSignatureBytes = Buffer.from(providedSignature, "base64url");
  if (
    providedSignatureBytes.length !== expectedSignatureBytes.length
    || !timingSafeEqual(providedSignatureBytes, expectedSignatureBytes)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<CsrfPayload>;
    const expectedBinding = bindingDigest(binding);
    const payloadBindingBytes = Buffer.from(payload.binding ?? "", "base64url");
    const expectedBindingBytes = Buffer.from(expectedBinding, "base64url");
    return payload.version === 1
      && Number.isSafeInteger(payload.expiresAt)
      && payload.expiresAt! > now
      && payload.expiresAt! <= now + CSRF_TOKEN_TTL_MS + 30_000
      && typeof payload.nonce === "string"
      && /^[A-Za-z0-9_-]{22}$/.test(payload.nonce)
      && payloadBindingBytes.length === expectedBindingBytes.length
      && timingSafeEqual(payloadBindingBytes, expectedBindingBytes);
  } catch {
    return false;
  }
}

export function issueCsrfToken(req: Request, res: Response, now = Date.now()): void {
  let binding = authenticatedBinding(req);
  if (!binding) {
    const anonymousSession = readCookie(req.headers.cookie, ANONYMOUS_CSRF_COOKIE)
      ?? randomBytes(32).toString("base64url");
    res.cookie(ANONYMOUS_CSRF_COOKIE, anonymousSession, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: CSRF_TOKEN_TTL_MS,
    });
    binding = `anonymous:v1:${anonymousSession}`;
  }

  res.setHeader(CSRF_HEADER_NAME, createCsrfToken(binding, now));
}

export function isValidCsrfRequest(
  req: Request,
  token: string | undefined,
  now = Date.now(),
): boolean {
  return verifyCsrfToken(token, requestBinding(req), now);
}
