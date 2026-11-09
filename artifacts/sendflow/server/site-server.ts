import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { enforceIpAccess, trustedProxyHops } from "@workspace/db/ip-blocklist";
import { isAdminHostAllowed } from "./admin-host-policy.ts";
import { isKnownSitePage } from "./site-route-matcher.ts";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp4": "video/mp4", ".pdf": "application/pdf",
};

function sendNotFound(req: IncomingMessage, res: ServerResponse) {
  const body = "404 Not Found";
  res.statusCode = 404;
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Length", String(Buffer.byteLength(body)));
  res.end(req.method === "HEAD" ? undefined : body);
}

/** Shared by the production entry and isolated tests; every file passes the gate. */
export function createSiteServer(
  rootDirectory: string,
  gate: (req: IncomingMessage, res: ServerResponse) => Promise<boolean> = enforceIpAccess,
) {
  const root = resolve(rootDirectory);
  const server = createServer(async (req, res) => {
    try {
      if (!await gate(req, res)) return;
      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000");
      }
      const adminHost = isAdminHostAllowed(req.headers.host ?? "");
      if (adminHost) {
        const connectSources = (process.env.SENDFLOW_ADMIN_CSP_CONNECT_SRC ?? "")
          .split(/\s+/u)
          .filter((source) => /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/u.test(source))
          .join(" ");
        res.setHeader(
          "Content-Security-Policy",
          `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${connectSources}`.trim(),
        );
      }
      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(req.url ?? "/", "http://internal.invalid").pathname);
      } catch {
        sendNotFound(req, res);
        return;
      }
      if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((p) => p.startsWith("."))) {
        sendNotFound(req, res); return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD"); res.writeHead(405).end(); return;
      }
      let file = resolve(root, `.${pathname}`);
      if (!file.startsWith(root + sep) && file !== root) { sendNotFound(req, res); return; }
      let info;
      try { info = await stat(file); } catch { /* SPA fallback below, never to arbitrary files. */ }
      if (!info?.isFile()) {
        const isApiPath = pathname === "/api" || pathname.startsWith("/api/");
        const isKnownPage = isKnownSitePage(
          req.headers.host ?? "",
          pathname,
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
      if (adminHost && file.endsWith("index.html")) {
        const html = await readFile(actual, "utf8");
        const protectedHtml = html.replace(
          /<\/head>/iu,
          '<meta name="sendflow-app-surface" content="admin"></head>',
        );
        res.setHeader("Content-Length", String(Buffer.byteLength(protectedHtml)));
        res.end(protectedHtml);
        return;
      }
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
  const root = fileURLToPath(new URL("../public/", import.meta.url));
  const server = createSiteServer(root);
  server.listen(port, "0.0.0.0");
  return server;
}
