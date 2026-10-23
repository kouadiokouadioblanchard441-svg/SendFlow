import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";

export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const CSRF_TOKEN_TTL_MS = 10 * 60 * 1000;
export const ANONYMOUS_CSRF_COOKIE_TTL_MS = 24 * 60 * 60 * 1000;
export const ANONYMOUS_CSRF_COOKIE = "__Host-sendflow_csrf";

const CUSTOMER_SESSION_COOKIE = "__Host-sendflow_session";
const ADMIN_SESSION_COOKIE = "__Host-sendflow_admin";
const OPAQUE_COOKIE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ANONYMOUS_COOKIE_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type CsrfPayload = {
  version: 1;
  expiresAt: number;
  binding: string;
  nonce: string;
};

type RequestBinding = {
  value: string;
  expiresAt?: number;
};

type AnonymousCsrfCookie = {
  nonce: string;
  expiresAt: number;
  binding: string;
};

function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const matches = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  return matches[0]!.slice(name.length + 1);
}

function readOpaqueCookie(cookieHeader: string | undefined, name: string): string | null {
  const value = readCookieValue(cookieHeader, name);
  return value && OPAQUE_COOKIE_PATTERN.test(value) ? value : null;
}

function authenticatedBinding(req: Request): string | null {
  const customerSession = readOpaqueCookie(req.headers.cookie, CUSTOMER_SESSION_COOKIE);
  const adminSession = readOpaqueCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (customerSession || adminSession) {
    return `authenticated:v1:${customerSession ?? ""}:${adminSession ?? ""}`;
  }
  return null;
}

function anonymousCookieSignature(payload: string): string {
  return createHmac("sha256", signingKey())
    .update(`sendflow:csrf-anonymous-cookie:v1:${payload}`)
    .digest("base64url");
}

export function createAnonymousCsrfCookie(now = Date.now()): {
  value: string;
  nonce: string;
  expiresAt: number;
  binding: string;
} {
  const nonce = randomBytes(32).toString("base64url");
  const expiresAt = now + ANONYMOUS_CSRF_COOKIE_TTL_MS;
  const payload = `v1.${expiresAt}.${nonce}`;
  const signature = anonymousCookieSignature(payload);
  return {
    value: `${payload}.${signature}`,
    nonce,
    expiresAt,
    binding: `anonymous:v1:${expiresAt}:${nonce}`,
  };
}

function readAnonymousCsrfCookie(
  cookieHeader: string | undefined,
  now = Date.now(),
): AnonymousCsrfCookie | null {
  const value = readCookieValue(cookieHeader, ANONYMOUS_CSRF_COOKIE);
  if (!value) return null;

  const [version, expiryValue, nonce, providedSignature, ...extra] = value.split(".");
  const expiresAt = Number(expiryValue);
  if (
    version !== "v1"
    || !expiryValue
    || String(expiresAt) !== expiryValue
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now
    || expiresAt > now + ANONYMOUS_CSRF_COOKIE_TTL_MS + 30_000
    || !nonce
    || !ANONYMOUS_COOKIE_NONCE_PATTERN.test(nonce)
    || !providedSignature
    || !SIGNATURE_PATTERN.test(providedSignature)
    || Buffer.from(providedSignature, "base64url").toString("base64url") !== providedSignature
    || extra.length > 0
  ) {
    return null;
  }

  let expectedSignature: string;
  try {
    expectedSignature = anonymousCookieSignature(`v1.${expiryValue}.${nonce}`);
  } catch {
    return null;
  }
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  const providedBytes = Buffer.from(providedSignature, "base64url");
  if (
    expectedBytes.length !== providedBytes.length
    || !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    return null;
  }

  return {
    nonce,
    expiresAt,
    binding: `anonymous:v1:${expiresAt}:${nonce}`,
  };
}

function requestBinding(req: Request, now = Date.now()): RequestBinding | null {
  const authenticated = authenticatedBinding(req);
  if (authenticated) return { value: authenticated };
  const anonymousCookie = readAnonymousCsrfCookie(req.headers.cookie, now);
  return anonymousCookie
    ? { value: anonymousCookie.binding, expiresAt: anonymousCookie.expiresAt }
    : null;
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

export function createCsrfToken(
  binding: string,
  now = Date.now(),
  expiresAtLimit = Number.POSITIVE_INFINITY,
): string {
  const payload: CsrfPayload = {
    version: 1,
    expiresAt: Math.min(now + CSRF_TOKEN_TTL_MS, expiresAtLimit),
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
  expiresAtLimit = Number.POSITIVE_INFINITY,
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
      && payload.expiresAt! <= expiresAtLimit
      && typeof payload.nonce === "string"
      && /^[A-Za-z0-9_-]{22}$/.test(payload.nonce)
      && payloadBindingBytes.length === expectedBindingBytes.length
      && timingSafeEqual(payloadBindingBytes, expectedBindingBytes);
  } catch {
    return false;
  }
}

export function issueCsrfToken(req: Request, res: Response, now = Date.now()): void {
  const authenticated = authenticatedBinding(req);
  let binding: RequestBinding;
  if (authenticated) {
    binding = { value: authenticated };
  } else {
    let anonymousCookie = readAnonymousCsrfCookie(req.headers.cookie, now);
    if (!anonymousCookie) {
      const issuedCookie = createAnonymousCsrfCookie(now);
      res.cookie(ANONYMOUS_CSRF_COOKIE, issuedCookie.value, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
        maxAge: issuedCookie.expiresAt - now,
      });
      anonymousCookie = issuedCookie;
    }
    binding = {
      value: anonymousCookie.binding,
      expiresAt: anonymousCookie.expiresAt,
    };
  }

  res.setHeader(
    CSRF_HEADER_NAME,
    createCsrfToken(binding.value, now, binding.expiresAt),
  );
}

export function isValidCsrfRequest(
  req: Request,
  token: string | undefined,
  now = Date.now(),
): boolean {
  const binding = requestBinding(req, now);
  return verifyCsrfToken(token, binding?.value ?? null, now, binding?.expiresAt);
}
