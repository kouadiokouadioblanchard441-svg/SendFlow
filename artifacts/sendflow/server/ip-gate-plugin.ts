import type { Plugin, Connect } from "vite";
import { checkPortalRouteAccess } from "./portal-route-access";
import { isPortalRouteRequest } from "./portal-route-path";

// Vite configuration only, never part of the browser bundle.
const gate: Connect.NextHandleFunction = (req, res, next) => {
  void (async () => {
    try {
      const { enforceIpAccess } = await import("@workspace/db/ip-blocklist");
      if (!(await enforceIpAccess(req, res))) return;
      if (isPortalRouteRequest(req.url, process.env.BASE_PATH ?? "/")) {
        const access = await checkPortalRouteAccess(req);
        if (access !== "allowed") {
          res.statusCode = access === "not-found" ? 404 : 503;
          res.setHeader("Cache-Control", "no-store, private");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Referrer-Policy", "no-referrer");
          res.end();
          return;
        }
      }
      next();
    } catch {
      res.statusCode = 503;
      res.setHeader("Cache-Control", "no-store");
      res.end("Service temporairement indisponible.");
    }
  })();
};

export function ipGatePlugin(): Plugin {
  return {
    name: "sendflow-server-ip-gate",
    configureServer(server) { server.middlewares.use(gate); },
    configurePreviewServer(server) { server.middlewares.use(gate); },
  };
}
