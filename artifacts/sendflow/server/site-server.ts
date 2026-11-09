import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { enforceIpAccess, requestIp, trustedProxyHops } from "@workspace/db/ip-blocklist";
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

const PRIVATE_ASSET_PREFIX = "/__sendflow_private_bundle__/";
const MAX_GATE_FORM_BYTES = 2048;
const GATE_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const GATE_FAILURE_LIMIT = 5;
const gateFailures = new Map<string, { count: number; expiresAt: number }>();

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp4": "video/mp4", ".pdf": "application/pdf",
};

const gateForm = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Accès sécurisé</title></head>
<body style="font:16px system-ui,sans-serif;background:#f7f7fb;margin:0;min-height:100vh;display:grid;place-items:center">
<main style="background:white;padding:2rem;border:1px solid #e2e8f0;border-radius:1rem;width:min(22rem,calc(100% - 4rem))">
<h1 style="font-size:1.25rem;margin:0 0 .5rem">Accès sécurisé</h1>
<p style="color:#475569;line-height:1.5">Saisissez le jeton d’accès pour continuer.</p>
<form method="post" autocomplete="off"><label for="gate-token">Jeton d’accès</label>
<input id="gate-token" name="token" type="password" minlength="32" maxlength="256" required autocomplete="off"
style="box-sizing:border-box;width:100%;margin:.5rem 0 1rem;padding:.7rem;border:1px solid #cbd5e1;border-radius:.5rem">
<button type="submit" style="width:100%;padding:.75rem;border:0;border-radius:.5rem;background:#6d28d9;color:white;font-weight:600">Continuer</button>
</form></main></body></html>`;

function sendNotFound(req: IncomingMessage, res: ServerResponse) {
  const body = "404 Not Found";
  res.statusCode = 404;
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Length", String(Buffer.byteLength(body)));
  res.end(req.method === "HEAD" ? undefined : body);
}

function setPrivateResponseHeaders(res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
}

function requestPath(req: IncomingMessage): { pathname: string; hasQuery: boolean } {
  const rawUrl = req.url ?? "/";
  const queryIndex = rawUrl.indexOf("?");
  return {
    pathname: queryIndex < 0 ? rawUrl : rawUrl.slice(0, queryIndex),
    hasQuery: queryIndex >= 0,
  };
}

function getGateFailureKey(req: IncomingMessage) {
  return requestIp(req, trustedProxyHops(process.env.TRUST_PROXY_HOPS, process.env.NODE_ENV))
    ?? req.socket.remoteAddress
    ?? "unknown";
}

function isGateRateLimited(req: IncomingMessage, now = Date.now()) {
  for (const [key, bucket] of gateFailures) {
    if (bucket.expiresAt <= now) gateFailures.delete(key);
  }
  const bucket = gateFailures.get(getGateFailureKey(req));
  return Boolean(bucket && bucket.count >= GATE_FAILURE_LIMIT && bucket.expiresAt > now);
}

function recordGateFailure(req: IncomingMessage, now = Date.now()) {
  const key = getGateFailureKey(req);
  const bucket = gateFailures.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    if (gateFailures.size >= 10_000) {
      const oldestKey = gateFailures.keys().next().value;
      if (oldestKey) gateFailures.delete(oldestKey);
    }
    gateFailures.set(key, { count: 1, expiresAt: now + GATE_FAILURE_WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

async function readGateToken(req: IncomingMessage): Promise<string | null> {
  if ((req.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase()
    !== "application/x-www-form-urlencoded") return null;
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_GATE_FORM_BYTES) return null;

  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_GATE_FORM_BYTES) return null;
      chunks.push(buffer);
    }
  } catch {
    return null;
  }

  const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  const values = params.getAll("token");
  if (params.size !== 1 || values.length !== 1) return null;
  const token = values[0] ?? "";
  return token.length >= 32 && token.length <= 256 ? token : null;
}

function serveInlineHtml(
  req: IncomingMessage,
  res: ServerResponse,
  html: string,
) {
  setPrivateResponseHeaders(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Length", String(Buffer.byteLength(html)));
  res.statusCode = 200;
  res.end(req.method === "HEAD" ? undefined : html);
}

async function servePrivateEntry(
  req: IncomingMessage,
  res: ServerResponse,
  privateRoot: string,
) {
  const entry = resolve(privateRoot, "index.html");
  try {
    const info = await stat(entry);
    if (!info.isFile()) {
      sendNotFound(req, res);
      return;
    }
    const actual = await realpath(entry);
    if (!actual.startsWith(privateRoot + sep)) {
      sendNotFound(req, res);
      return;
    }
    setPrivateResponseHeaders(res);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Length", info.size);
    res.statusCode = 200;
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(actual).pipe(res);
  } catch {
    sendNotFound(req, res);
  }
}

/** Shared by the production entry and isolated tests; every file passes the gate. */
export function createSiteServer(
  distributionDirectory: string,
  gate: (req: IncomingMessage, res: ServerResponse) => Promise<boolean> = enforceIpAccess,
) {
  const distributionRoot = resolve(distributionDirectory);
  const publicRoot = resolve(distributionRoot, "public");
  const privateRoot = resolve(distributionRoot, "admin");
  const server = createServer(async (req, res) => {
    try {
      if (!await gate(req, res)) return;
      const { pathname, hasQuery } = requestPath(req);
      const configuration = getAdminGateConfiguration(process.env);
      const cookieValid = hasValidAdminGateCookie(req.headers.cookie, process.env);
      const adminPathMatches = Boolean(
        configuration
        && !hasQuery
        && !isKnownSitePage(req.headers.host ?? "", configuration.path, process.env.BASE_PATH ?? "/")
        && constantTimeSecretMatch(pathname, configuration.path),
      );

      if (pathname.startsWith(PRIVATE_ASSET_PREFIX)) {
        if (
          !configuration
          || !cookieValid
          || (req.method !== "GET" && req.method !== "HEAD")
        ) {
          sendNotFound(req, res);
          return;
        }
        setPrivateResponseHeaders(res);
        const assetPath = pathname.slice(PRIVATE_ASSET_PREFIX.length);
        if (!assetPath || assetPath.split("/").some((part) => !part || part.startsWith("."))) {
          sendNotFound(req, res);
          return;
        }
        const privateAsset = resolve(privateRoot, assetPath);
        if (!privateAsset.startsWith(privateRoot + sep)) {
          sendNotFound(req, res);
          return;
        }
        let assetInfo;
        try {
          assetInfo = await stat(privateAsset);
        } catch {
          sendNotFound(req, res);
          return;
        }
        if (!assetInfo.isFile() || privateAsset.endsWith(".map")) {
          sendNotFound(req, res);
          return;
        }
        const actual = await realpath(privateAsset);
        if (!actual.startsWith(privateRoot + sep)) {
          sendNotFound(req, res);
          return;
        }
        res.setHeader("Content-Type", mime[extname(privateAsset)] ?? "application/octet-stream");
        res.setHeader("Content-Length", assetInfo.size);
        res.statusCode = 200;
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(actual).pipe(res);
        return;
      }

      if (adminPathMatches && configuration) {
        if (req.method === "GET" || req.method === "HEAD") {
          if (cookieValid) {
            await servePrivateEntry(req, res, privateRoot);
          } else {
            serveInlineHtml(req, res, gateForm);
          }
          return;
        }
        if (req.method === "POST") {
          if (
            !isSameOriginAdminGatePost(
              req.headers.host,
              req.headers.origin,
              req.headers["sec-fetch-site"],
              process.env,
            )
            || isGateRateLimited(req)
          ) {
            sendNotFound(req, res);
            return;
          }
          const candidate = await readGateToken(req);
          if (!candidate || !constantTimeSecretMatch(candidate, configuration.token)) {
            recordGateFailure(req);
            sendNotFound(req, res);
            return;
          }
          gateFailures.delete(getGateFailureKey(req));
          const expiresAt = Date.now() + ADMIN_GATE_COOKIE_TTL_MS;
          const value = createAdminGateCookieValue(configuration.token, expiresAt);
          res.setHeader(
            "Set-Cookie",
            `${ADMIN_GATE_COOKIE}=${value}; Path=/; Max-Age=${Math.floor(ADMIN_GATE_COOKIE_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Strict`,
          );
          await servePrivateEntry(req, res, privateRoot);
          return;
        }
        sendNotFound(req, res);
        return;
      }

      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000");
      }
      const root = publicRoot;
      let rootInfo;
      try {
        rootInfo = await stat(root);
      } catch {
        sendNotFound(req, res);
        return;
      }
      if (!rootInfo.isDirectory()) {
        sendNotFound(req, res);
        return;
      }
      let decodedPathname: string;
      try {
        decodedPathname = decodeURIComponent(pathname);
      } catch {
        sendNotFound(req, res);
        return;
      }
      if (decodedPathname.includes("\0") || decodedPathname.includes("\\") || decodedPathname.split("/").some((p) => p.startsWith("."))) {
        sendNotFound(req, res); return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendNotFound(req, res);
        return;
      }
      let file = resolve(root, `.${decodedPathname}`);
      if (!file.startsWith(root + sep) && file !== root) { sendNotFound(req, res); return; }
      let info;
      try { info = await stat(file); } catch { /* SPA fallback below, never to arbitrary files. */ }
      if (!info?.isFile()) {
        const isApiPath = decodedPathname === "/api" || decodedPathname.startsWith("/api/");
        const isKnownPage = isKnownSitePage(
          req.headers.host ?? "",
          decodedPathname,
          process.env.BASE_PATH ?? "/",
        );
        if (extname(pathname) || isApiPath || !isKnownPage) { sendNotFound(req, res); return; }
        file = resolve(root, "index.html");
        info = await stat(file);
      }
      const actual = await realpath(file);
      if (!actual.startsWith(root + sep) || file.endsWith(".map")) { sendNotFound(req, res); return; }
      res.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      res.statusCode = 200;
      if (req.method === "HEAD") { res.end(); return; }
      res.setHeader("Content-Length", info.size);
      const stream = createReadStream(actual);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    } catch {
      if (!res.headersSent) { res.setHeader("Cache-Control", "no-store"); res.writeHead(503); }
      res.end("Service temporairement indisponible.");
    }
  });
  // No application WebSocket endpoint is exposed by this static origin.
  server.on("upgrade", (_req, socket) => socket.destroy());
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
}

export function startSiteServer() {
  trustedProxyHops(process.env.TRUST_PROXY_HOPS, process.env.NODE_ENV);
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Valid PORT is required");
  const distributionRoot = fileURLToPath(new URL("../", import.meta.url));
  const server = createSiteServer(distributionRoot);
  server.listen(port, "0.0.0.0");
  return server;
}
