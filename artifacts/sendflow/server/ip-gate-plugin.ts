import type { Plugin, Connect } from "vite";

// Vite configuration only, never part of the browser bundle.
const gate: Connect.NextHandleFunction = (req, res, next) => {
  void (async () => {
    try {
      const { enforceIpAccess } = await import("@workspace/db/ip-blocklist");
      if (await enforceIpAccess(req, res)) next();
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
