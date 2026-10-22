import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { enforceIpAccess, trustedProxyHops } from "@workspace/db/ip-blocklist";

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".mp4": "video/mp4", ".pdf": "application/pdf",
};

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
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.setHeader("Allow", "GET, HEAD"); res.writeHead(405).end(); return;
      }
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://internal.invalid").pathname);
      if (pathname.includes("\0") || pathname.includes("\\") || pathname.split("/").some((p) => p.startsWith("."))) {
        res.writeHead(404).end(); return;
      }
      let file = resolve(root, `.${pathname}`);
      if (!file.startsWith(root + sep) && file !== root) { res.writeHead(404).end(); return; }
      let info;
      try { info = await stat(file); } catch { /* SPA fallback below, never to arbitrary files. */ }
      if (!info?.isFile()) {
        if (extname(pathname) || pathname.startsWith("/api/")) { res.writeHead(404).end(); return; }
        file = resolve(root, "index.html");
        info = await stat(file);
      }
      const actual = await realpath(file);
      if (!actual.startsWith(root + sep) || file.endsWith(".map")) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
      res.setHeader("Content-Length", info.size);
      res.statusCode = 200;
      if (req.method === "HEAD") { res.end(); return; }
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
