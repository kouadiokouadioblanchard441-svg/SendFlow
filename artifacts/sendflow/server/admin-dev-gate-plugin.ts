import type { Connect, Plugin } from "vite";
import type { ServerResponse } from "node:http";
import {
  ADMIN_GATE_COOKIE,
  ADMIN_GATE_COOKIE_TTL_MS,
  constantTimeSecretMatch,
  createAdminGateCookieValue,
  getAdminGateConfiguration,
  hasValidAdminGateCookie,
  isSameOriginAdminGatePost,
} from "@workspace/admin-gate";
import { isKnownSitePage } from "./site-route-matcher.ts";

const PRIVATE_DEV_ENTRY = "/admin.html";
const MAX_FORM_BYTES = 2048;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
const FAILURE_LIMIT = 5;
const failures = new Map<string, { count: number; expiresAt: number }>();

const challenge = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Accès sécurisé</title></head><body style="font:16px system-ui,sans-serif;background:#f7f7fb;margin:0;min-height:100vh;display:grid;place-items:center">
<main style="background:white;padding:2rem;border:1px solid #e2e8f0;border-radius:1rem;width:min(22rem,calc(100% - 4rem))">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">Accès sécurisé</h1><p style="color:#475569;line-height:1.5">Saisissez le jeton d’accès pour continuer.</p>
<form method="post" autocomplete="off"><label for="gate-token">Jeton d’accès</label>
<input id="gate-token" name="token" type="password" minlength="32" maxlength="256" required autocomplete="off"
style="box-sizing:border-box;width:100%;margin:.5rem 0 1rem;padding:.7rem;border:1px solid #cbd5e1;border-radius:.5rem">
<button type="submit" style="width:100%;padding:.75rem;border:0;border-radius:.5rem;background:#6d28d9;color:white;font-weight:600">Continuer</button>
</form></main></body></html>`;

function sendNotFound(req: Connect.IncomingMessage, res: ServerResponse) {
  const body = "404 Not Found";
  res.statusCode = 404;
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Length", String(Buffer.byteLength(body)));
  res.end(req.method === "HEAD" ? undefined : body);
}

function sendChallenge(req: Connect.IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'unsafe-inline'",
  );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Length", String(Buffer.byteLength(challenge)));
  res.end(req.method === "HEAD" ? undefined : challenge);
}

function requestPath(req: Connect.IncomingMessage) {
  const rawUrl = req.url ?? "/";
  const queryIndex = rawUrl.indexOf("?");
  return {
    pathname: queryIndex < 0 ? rawUrl : rawUrl.slice(0, queryIndex),
    hasQuery: queryIndex >= 0,
  };
}

function failureKey(req: Connect.IncomingMessage) {
  // Development Vite is not an authority for production client IPs. Never
  // trust caller-supplied forwarding headers for this local rate-limit bucket.
  return req.socket.remoteAddress ?? "unknown";
}

function isLimited(req: Connect.IncomingMessage, now = Date.now()) {
  for (const [key, bucket] of failures) {
    if (bucket.expiresAt <= now) failures.delete(key);
  }
  const bucket = failures.get(failureKey(req));
  return Boolean(bucket && bucket.count >= FAILURE_LIMIT && bucket.expiresAt > now);
}

function recordFailure(req: Connect.IncomingMessage, now = Date.now()) {
  const key = failureKey(req);
  const bucket = failures.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (failures.size >= 10_000) {
      const oldest = failures.keys().next().value;
      if (oldest) failures.delete(oldest);
    }
    failures.set(key, { count: 1, expiresAt: now + FAILURE_WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

async function readToken(req: Connect.IncomingMessage): Promise<string | null> {
  if ((req.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase()
    !== "application/x-www-form-urlencoded") return null;
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_FORM_BYTES) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += value.length;
      if (size > MAX_FORM_BYTES) return null;
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  const values = form.getAll("token");
  if (form.size !== 1 || values.length !== 1) return null;
  const token = values[0] ?? "";
  return token.length >= 32 && token.length <= 256 ? token : null;
}

function protectAdminDevRoutes(basePath: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const configuration = getAdminGateConfiguration(process.env);
    const { pathname, hasQuery } = requestPath(req);
    const isAdminEntry = pathname === PRIVATE_DEV_ENTRY
      || pathname === "/src/admin-main.tsx"
      || pathname === "/src/admin-app.tsx"
      || /^\/src\/pages\/admin(?:[-.]|\/)/u.test(pathname)
      || /^\/src\/components\/admin-/u.test(pathname)
      || /^\/src\/lib\/admin-/u.test(pathname);

    if (isAdminEntry && !hasValidAdminGateCookie(req.headers.cookie, process.env)) {
      sendNotFound(req, res);
      return;
    }

    const exactGatePath = Boolean(
      configuration
      && !hasQuery
      && !isKnownSitePage(req.headers.host ?? "", configuration.path, basePath)
      && constantTimeSecretMatch(pathname, configuration.path),
    );
    if (!exactGatePath || !configuration) {
      next();
      return;
    }

    const gateCookieValid = hasValidAdminGateCookie(req.headers.cookie, process.env);
    const serveEntry = () => {
      req.url = PRIVATE_DEV_ENTRY;
      if (req.method === "POST") req.method = "GET";
      next();
    };

    if (req.method === "GET" || req.method === "HEAD") {
      if (gateCookieValid) serveEntry();
      else sendChallenge(req, res);
      return;
    }

    if (
      req.method !== "POST"
      || !isSameOriginAdminGatePost(
        req.headers.host,
        req.headers.origin,
        req.headers["sec-fetch-site"],
        process.env,
      )
      || isLimited(req)
    ) {
      sendNotFound(req, res);
      return;
    }

    void readToken(req).then((candidate) => {
      if (!candidate || !constantTimeSecretMatch(candidate, configuration.token)) {
        recordFailure(req);
        sendNotFound(req, res);
        return;
      }
      failures.delete(failureKey(req));
      const expiresAt = Date.now() + ADMIN_GATE_COOKIE_TTL_MS;
      const value = createAdminGateCookieValue(configuration.token, expiresAt);
      res.setHeader(
        "Set-Cookie",
        `${ADMIN_GATE_COOKIE}=${value}; Path=/; Max-Age=${Math.floor(ADMIN_GATE_COOKIE_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Strict`,
      );
      serveEntry();
    }).catch(() => sendNotFound(req, res));
  };
}

export function adminDevGatePlugin(basePath: string): Plugin {
  return {
    name: "sendflow-admin-secret-gate",
    configureServer(server) {
      server.middlewares.use(protectAdminDevRoutes(basePath));
    },
    configurePreviewServer(server) {
      server.middlewares.use(protectAdminDevRoutes(basePath));
    },
  };
}
