import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_GATE_COOKIE = "__Host-sendflow_access_gate";
export const ADMIN_GATE_COOKIE_TTL_MS = 8 * 60 * 60 * 1000;

export type AdminGateEnvironment = {
  NODE_ENV?: string;
  ADMIN_SECRET_PATH?: string;
  ADMIN_SECRET_TOKEN?: string;
};

export type AdminGateConfiguration = {
  path: string;
  token: string;
};

const routePattern = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u;
const tokenPattern = /^[A-Za-z0-9_-]{32,256}$/u;

export function getAdminGateConfiguration(
  environment: AdminGateEnvironment = process.env,
): AdminGateConfiguration | null {
  const path = environment.ADMIN_SECRET_PATH;
  const token = environment.ADMIN_SECRET_TOKEN;
  if (
    !path
    || path.length < 25
    || path.length > 512
    || !routePattern.test(path)
    || path.startsWith("/api/")
    || path.startsWith("/assets/")
    || path.startsWith("/__sendflow_private_bundle__/")
    || !token
    || !tokenPattern.test(token)
  ) return null;
  return { path, token };
}

/** Hashes both inputs first so unequal-length secrets still compare in constant time. */
export function constantTimeSecretMatch(candidate: string, expected: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export function createAdminGateCookieValue(
  token: string,
  expiresAtMs = Date.now() + ADMIN_GATE_COOKIE_TTL_MS,
  nonce = randomBytes(24).toString("base64url"),
): string {
  const payload = Buffer.from(`${expiresAtMs}.${nonce}`).toString("base64url");
  const signature = createHmac("sha256", token).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminGateCookieValue(
  cookieValue: string | null | undefined,
  configuration: AdminGateConfiguration | null,
  nowMs = Date.now(),
): boolean {
  if (!cookieValue || !configuration || cookieValue.length > 512) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature || !/^[A-Za-z0-9_-]+$/u.test(payload)) return false;

  const expectedSignature = createHmac("sha256", configuration.token)
    .update(payload)
    .digest();
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(".");
  if (separator < 1) return false;
  const expiresAt = Number(decoded.slice(0, separator));
  const nonce = decoded.slice(separator + 1);
  return Number.isSafeInteger(expiresAt)
    && expiresAt > nowMs
    && expiresAt <= nowMs + ADMIN_GATE_COOKIE_TTL_MS
    && /^[A-Za-z0-9_-]{32}$/u.test(nonce);
}

export function readAdminGateCookie(cookieHeader: string | undefined): string | null {
  const matches = cookieHeader?.split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${ADMIN_GATE_COOKIE}=`)) ?? [];
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(ADMIN_GATE_COOKIE.length + 1);
  if (!value || value.length > 512 || !/^[A-Za-z0-9_.-]+$/u.test(value)) return null;
  return value;
}

export function hasValidAdminGateCookie(
  cookieHeader: string | undefined,
  environment: AdminGateEnvironment = process.env,
  nowMs = Date.now(),
): boolean {
  return verifyAdminGateCookieValue(
    readAdminGateCookie(cookieHeader),
    getAdminGateConfiguration(environment),
    nowMs,
  );
}

export function isSameOriginAdminGatePost(
  hostHeader: string | undefined,
  originHeader: string | undefined,
  fetchSiteHeader: string | undefined,
  environment: AdminGateEnvironment = process.env,
): boolean {
  if (!hostHeader || !originHeader) return false;
  if (fetchSiteHeader && fetchSiteHeader.toLowerCase() !== "same-origin") return false;
  try {
    const expectedHostUrl = new URL(`https://${hostHeader}`);
    const originUrl = new URL(originHeader);
    if (
      expectedHostUrl.username
      || expectedHostUrl.password
      || expectedHostUrl.pathname !== "/"
      || expectedHostUrl.search
      || expectedHostUrl.hash
      || originUrl.username
      || originUrl.password
      || originUrl.pathname !== "/"
      || originUrl.search
      || originUrl.hash
      || originUrl.host.toLowerCase() !== expectedHostUrl.host.toLowerCase()
    ) return false;
    if (environment.NODE_ENV === "production" && originUrl.protocol !== "https:") return false;
    return originUrl.protocol === "http:" || originUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/** Detects admin API path variants before Express route matching, including encoded separators. */
export function isAdminApiRequestPath(rawUrl: string): boolean {
  let pathname = rawUrl.split("?", 1)[0] ?? "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    } catch {
      return pathname.toLowerCase().startsWith("/api");
    }
  }
  pathname = pathname.replaceAll("\\", "/").replace(/\/{2,}/gu, "/");
  if (!/^\/api(?:\/|$)/iu.test(pathname)) return false;
  return pathname.split("/").some((segment) => segment.toLowerCase() === "admin");
}
