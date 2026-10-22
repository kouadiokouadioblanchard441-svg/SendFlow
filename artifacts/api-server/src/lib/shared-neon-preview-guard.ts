type Environment = Readonly<Record<string, string | undefined>>;
const publicReadPathPrefixes = [
  "/api/auth/countries",
  "/api/auth/registration-settings",
  "/api/banners",
  "/api/db-status",
  "/api/healthz",
  "/api/pricing",
  "/api/storage/public-objects",
];

export function normalizeRequestPath(requestPath: string): string | null {
  let pathname = requestPath.split(/[?#]/, 1)[0] || "/";

  try {
    let fullyDecoded = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) {
        fullyDecoded = true;
        break;
      }
      pathname = decoded;
    }
    if (!fullyDecoded) return null;
  } catch {
    return null;
  }

  if (pathname.includes("\\") || pathname.includes("?") || pathname.includes("#") || pathname.includes("\0")) {
    return null;
  }

  if (pathname.split("/").some((segment) => segment === "." || segment === "..")) return null;

  return pathname
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase() || "/";
}

export function isSharedNeonPreview(environment: Environment = process.env): boolean {
  return environment.SENDFLOW_DATABASE_TARGET === "shared-neon";
}

// This is only a route candidate, NOT an authorization. The second gate checks
// a scoped session; sign-in itself restricts its SQL lookup to the DB grant.
export function isViewerRouteCandidate(method: string, requestPath: string): boolean {
  const path = normalizeRequestPath(requestPath);
  if (!path) return false;
  if (method.toUpperCase() === "GET") {
    return ["/api/auth/session", "/api/me", "/api/me/transactions",
      "/api/me/account-limit", "/api/me/identity-verification", "/api/me/payment-readiness"].includes(path)
      || /^\/api\/me\/transactions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path)
      || /^\/api\/me\/payments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path);
  }
  if (method.toUpperCase() === "POST") {
    return ["/api/auth/sign-in", "/api/auth/sign-out", "/api/auth/unlock",
      "/api/me/transfer-quote", "/api/me/payments"].includes(path)
      || /^\/api\/me\/payments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/reconcile$/.test(path);
  }
  return method.toUpperCase() === "PUT" && path === "/api/me/pin";
}

function isPathOrChild(pathname: string, prefix: string): boolean {
  const normalizedPrefix = prefix
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
  return pathname === normalizedPrefix || pathname.startsWith(`${normalizedPrefix}/`);
}

export function shouldBlockSharedNeonApiRequest(
  method: string,
  requestPath: string,
  environment: Environment = process.env,
): boolean {
  if (environment.SENDFLOW_DATABASE_TARGET !== "shared-neon") return false;

  const pathname = normalizeRequestPath(requestPath);
  if (!pathname) return true;

  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "OPTIONS") return false;
  if (normalizedMethod !== "GET") return true;

  // Allow only known public reads; private and future API routes fail closed.
  return !publicReadPathPrefixes.some((prefix) => isPathOrChild(pathname, prefix));
}
