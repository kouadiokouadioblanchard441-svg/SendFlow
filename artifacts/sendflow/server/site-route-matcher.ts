import {
  getDocumentationPageKey,
  isSendFlowDocumentationHost,
  isSendFlowDocumentationPreviewRoute,
} from "../src/lib/documentation-host.ts";
import { isSendFlowPaymentHost } from "../src/lib/payment-host.ts";
import { isPortalRouteRequest } from "./portal-route-path.ts";

const exactApplicationPaths = new Set([
  "/",
  "/create-pin",
  "/pin",
  "/biometric",
  "/change-pin",
  "/change-pin-success",
  "/pricing",
  "/forgot-password",
  "/forgot-pin",
  "/account",
  "/account-info",
  "/email-unsubscribe",
  "/account-limit",
  "/identity-verification",
  "/linkflow",
  "/linkflow/new",
  "/developers",
  "/customer-service",
  "/deposit",
  "/international-transfer",
  "/inter-transfer",
  "/history",
  "/notifications",
  "/confidentialite",
  "/mentions-legales",
]);

const applicationPathPatterns = [
  /^\/sign-in(?:\/.*)?$/,
  /^\/sign-up(?:\/.*)?$/,
  /^\/linkflow\/[^/]+$/,
  /^\/pay\/[^/]+$/,
  /^\/transaction\/[^/]+$/,
  /^\/notifications\/[^/]+$/,
];

function normalizedHostname(hostname: string): string {
  const value = hostname.trim().toLowerCase();
  return value.replace(/:\d+$/, "");
}

function normalizedBasePath(basePath: string): string {
  const segments = basePath.split("/").filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "";
}

function stripBasePath(pathname: string, basePath: string): string {
  const base = normalizedBasePath(basePath);
  if (!base) return pathname;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

export function isKnownSitePage(
  hostname: string,
  pathname: string,
  basePath = "/",
): boolean {
  const host = normalizedHostname(hostname);
  const routePath = stripBasePath(pathname, basePath);

  if (isSendFlowDocumentationHost(host)) {
    return getDocumentationPageKey(routePath) !== null;
  }

  if (isSendFlowDocumentationPreviewRoute(host, routePath)) return true;

  if (isSendFlowPaymentHost(host)) {
    return /^\/pay\/[^/]+$/.test(routePath);
  }

  if (isPortalRouteRequest(pathname, basePath)) return true;
  return exactApplicationPaths.has(routePath)
    || applicationPathPatterns.some((pattern) => pattern.test(routePath));
}
