import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

function unsubscribeSignature(encodedUserId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`sendflow:email-marketing-unsubscribe:${TOKEN_VERSION}:${encodedUserId}`)
    .digest("base64url");
}

export function createEmailUnsubscribeToken(userId: string, secret: string) {
  if (!userId || !secret || secret.length < 32) {
    throw new Error("Email unsubscribe signing configuration is invalid");
  }
  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  return `${TOKEN_VERSION}.${encodedUserId}.${unsubscribeSignature(encodedUserId, secret)}`;
}

export function verifyEmailUnsubscribeToken(token: unknown, secret: string | undefined) {
  if (
    typeof token !== "string"
    || token.length > 1024
    || !secret
    || secret.length < 32
  ) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const [, encodedUserId, signature] = parts;
  if (!/^[A-Za-z0-9_-]{1,800}$/.test(encodedUserId) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    return null;
  }

  try {
    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(unsubscribeSignature(encodedUserId, secret), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const userId = Buffer.from(encodedUserId, "base64url").toString("utf8");
    if (!userId || userId.length > 255 || /[\u0000-\u001f\u007f]/.test(userId)) return null;
    return userId;
  } catch {
    return null;
  }
}
