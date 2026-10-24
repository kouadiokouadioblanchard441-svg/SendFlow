export const PORTAL_ROUTE_PATH = "/DMgrgmt-1np5g23g12bGFtMwh";
export const PORTAL_ELIGIBILITY_API_PATH = "/api/me/portal-eligibility";

function normalizeBasePath(basePath: string): string {
  const segments = basePath.split("/").filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "";
}

export function isPortalRouteRequest(
  requestUrl: string | undefined,
  basePath = "/",
): boolean {
  try {
    const pathname = decodeURIComponent(
      new URL(requestUrl ?? "/", "http://sendflow.invalid").pathname,
    );
    const base = normalizeBasePath(basePath);
    const relativePath = base && (pathname === base || pathname.startsWith(`${base}/`))
      ? pathname.slice(base.length) || "/"
      : pathname;

    return relativePath === PORTAL_ROUTE_PATH
      || relativePath.startsWith(`${PORTAL_ROUTE_PATH}/`);
  } catch {
    return false;
  }
}
