import type { IncomingMessage } from "node:http";
import { PORTAL_ELIGIBILITY_API_PATH } from "./portal-route-path.ts";

export type PortalRouteDecision = "allowed" | "not-found" | "unavailable";

type Environment = Record<string, string | undefined>;
type FetchFunction = typeof fetch;

export function resolveInternalApiOrigin(environment: Environment = process.env): string | null {
  const configured = environment.SENDFLOW_INTERNAL_API_ORIGIN?.trim();
  const value = configured || (
    environment.NODE_ENV === "production" ? "" : "http://127.0.0.1:8080"
  );
  if (!value) return null;

  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:")
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function checkPortalRouteAccess(
  request: Pick<IncomingMessage, "headers">,
  options: {
    environment?: Environment;
    fetcher?: FetchFunction;
    timeoutMs?: number;
  } = {},
): Promise<PortalRouteDecision> {
  const cookieHeader = request.headers.cookie;
  const cookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!cookie) return "not-found";

  const origin = resolveInternalApiOrigin(options.environment);
  if (!origin) return "unavailable";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 2_000);
  try {
    const response = await (options.fetcher ?? fetch)(
      new URL(PORTAL_ELIGIBILITY_API_PATH, origin),
      {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
      },
    );

    if ([401, 403, 404].includes(response.status)) return "not-found";
    if (!response.ok) return "unavailable";
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return "unavailable";
    }

    const payload: unknown = await response.json();
    return payload && typeof payload === "object"
      && "isAuthorized" in payload
      && payload.isAuthorized === true
      ? "allowed"
      : "not-found";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
}
