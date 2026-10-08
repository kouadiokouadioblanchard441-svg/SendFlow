import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";

const ADMIN_PIN_COOKIE = "__Host-sendflow-admin-pin";
const ADMIN_PIN_SESSION_TTL_MS = 15 * 60 * 1000;
const ADMIN_PIN_PATTERN = /^[0-9]{8}$/;

type AdminPinSessionPayload = {
  userId: string;
  clerkSessionId: string;
  expiresAt: number;
  nonce: string;
};

function getAdminPinSecret() {
  const pin = process.env.SENDFLOW_ADMIN_PIN;
  return pin && ADMIN_PIN_PATTERN.test(pin) ? pin : null;
}

function getSigningKey(pin: string) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || Buffer.byteLength(sessionSecret, "utf8") < 32) return null;

  return createHmac("sha256", sessionSecret)
    .update(`sendflow-admin-pin-session:v1:${pin}`)
    .digest();
}

function signPayload(encodedPayload: string, key: Buffer) {
  return createHmac("sha256", key).update(encodedPayload).digest("base64url");
}

export function isAdminPinConfigured() {
  const pin = getAdminPinSecret();
  return Boolean(pin && getSigningKey(pin));
}

export function verifyAdminPin(candidate: string) {
  const expected = getAdminPinSecret();
  if (!expected || !ADMIN_PIN_PATTERN.test(candidate)) return false;

  const expectedBytes = Buffer.from(expected, "utf8");
  const candidateBytes = Buffer.from(candidate, "utf8");
  return candidateBytes.length === expectedBytes.length
    && timingSafeEqual(candidateBytes, expectedBytes);
}

export function createAdminPinSessionToken(
  userId: string,
  clerkSessionId: string,
  now = Date.now(),
) {
  if (!clerkSessionId || clerkSessionId.length > 255) return null;

  const pin = getAdminPinSecret();
  const key = pin ? getSigningKey(pin) : null;
  if (!key) return null;

  const payload: AdminPinSessionPayload = {
    userId,
    clerkSessionId,
    expiresAt: now + ADMIN_PIN_SESSION_TTL_MS,
    nonce: randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${encodedPayload}.${signPayload(encodedPayload, key)}`;

  return {
    token,
    expiresAt: payload.expiresAt,
  };
}

export function verifyAdminPinSessionToken(
  token: string | undefined,
  userId: string,
  clerkSessionId: string | null | undefined,
  now = Date.now(),
) {
  if (!token || token.length > 2048 || !clerkSessionId || clerkSessionId.length > 255) {
    return false;
  }

  const [encodedPayload, providedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra.length > 0) return false;

  const pin = getAdminPinSecret();
  const key = pin ? getSigningKey(pin) : null;
  if (!key) return false;

  const expectedSignature = signPayload(encodedPayload, key);
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  const providedBytes = Buffer.from(providedSignature, "base64url");
  if (
    providedBytes.length !== expectedBytes.length
    || !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<AdminPinSessionPayload>;
    return payload.userId === userId
      && payload.clerkSessionId === clerkSessionId
      && typeof payload.expiresAt === "number"
      && Number.isSafeInteger(payload.expiresAt)
      && payload.expiresAt > now
      && payload.expiresAt <= now + ADMIN_PIN_SESSION_TTL_MS
      && typeof payload.nonce === "string"
      && /^[A-Za-z0-9_-]{22}$/.test(payload.nonce);
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return undefined;
}

export function hasAdminPinSession(
  req: Request,
  userId: string,
  clerkSessionId: string | null | undefined,
  now = Date.now(),
) {
  return verifyAdminPinSessionToken(
    readCookie(req, ADMIN_PIN_COOKIE),
    userId,
    clerkSessionId,
    now,
  );
}

export function setAdminPinSessionCookie(
  res: Response,
  userId: string,
  clerkSessionId: string,
) {
  const session = createAdminPinSessionToken(userId, clerkSessionId);
  if (!session) return null;

  const maxAge = Math.max(0, session.expiresAt - Date.now());
  res.cookie(ADMIN_PIN_COOKIE, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  });

  return new Date(session.expiresAt).toISOString();
}

export function getAdminPinAttemptBucket(userId: string) {
  return createHash("sha256")
    .update(`sendflow-admin-pin:${userId}`)
    .digest("hex");
}
