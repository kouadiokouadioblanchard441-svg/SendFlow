import type { IncomingHttpHeaders } from "node:http";
import type { RequestHandler } from "express";
import httpProxy from "http-proxy";
import {
  getTrustedHost,
  isAllowedRequestOrigin,
  type OriginEnvironment,
} from "../lib/origin-policy";

const CLERK_FAPI = "https://frontend-api.clerk.dev";
export const CLERK_PROXY_PATH = "/api/__clerk";

export function getClerkProxyHost(
  req: { headers: IncomingHttpHeaders },
  environment: OriginEnvironment = process.env,
): string | undefined {
  const forwarded = req.headers["x-forwarded-host"];
  if (Array.isArray(forwarded)) return undefined;
  const raw = forwarded ?? req.headers.host;
  return typeof raw === "string" ? getTrustedHost(raw, environment) : undefined;
}

export function isClerkProxyOriginAllowed(
  req: { headers: IncomingHttpHeaders; method: string },
  environment: OriginEnvironment = process.env,
): boolean {
  return isAllowedRequestOrigin(req.headers.origin, req.method, environment);
}

export function clerkProxyMiddleware(): RequestHandler {
  if (process.env.NODE_ENV !== "production" || !process.env.CLERK_SECRET_KEY) {
    return (_req, _res, next) => next();
  }

  const proxy = httpProxy.createProxyServer({
    target: CLERK_FAPI,
    changeOrigin: true,
    secure: true,
  });

  return (req, res): void => {
    const host = getClerkProxyHost(req);
    if (!host || !isClerkProxyOriginAllowed(req)) {
      res.status(403).json({ error: "Untrusted Clerk proxy host" });
      return;
    }

    const requestUrl = req.url ?? "/";
    req.url = requestUrl.startsWith(CLERK_PROXY_PATH)
      ? requestUrl.slice(CLERK_PROXY_PATH.length) || "/"
      : requestUrl;
    req.headers["clerk-proxy-url"] = `https://${host}${CLERK_PROXY_PATH}`;
    req.headers["clerk-secret-key"] = process.env.CLERK_SECRET_KEY!;

    proxy.web(req, res, {}, (error) => {
      req.log.error({ err: error }, "Clerk frontend API proxy failed");
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      res.status(502).json({ error: "Authentication provider unavailable" });
    });
  };
}