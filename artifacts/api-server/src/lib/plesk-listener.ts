import type { Express } from "express";
import type { Server } from "node:http";

export const PLESK_LISTEN_HOST = "0.0.0.0";

export function requirePleskPort(value: string | undefined): number {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error("PORT environment variable is required but was not provided.");
  }
  if (!/^\d+$/.test(normalized)) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

export function listenOnPleskPort(app: Pick<Express, "listen">, port: number): Server {
  return app.listen(port, PLESK_LISTEN_HOST);
}
