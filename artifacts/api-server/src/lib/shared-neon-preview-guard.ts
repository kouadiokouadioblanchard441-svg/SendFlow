type Environment = Readonly<Record<string, string | undefined>>;
const publicReadPathPrefixes = [
  "/api/auth/registration-settings",
  "/api/banners",
  "/api/db-status",
  "/api/healthz",
  "/api/pricing",
  "/api/storage/public-objects",
];

function normalizeRequestPath(requestPath: string): string | null {
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

  // Clerk's development sign-in proxy does not read or mutate SendFlow data.
  if (isPathOrChild(pathname, "/api/__clerk")) return false;

  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "OPTIONS") return false;
  if (normalizedMethod !== "GET") return true;

  // Allow only known public reads; private and future API routes fail closed.
  return !publicReadPathPrefixes.some((prefix) => isPathOrChild(pathname, prefix));
}
