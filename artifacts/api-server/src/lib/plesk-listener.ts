import type { Express } from "express";
import type { Server } from "node:http";

export const PLESK_LISTEN_HOST = "0.0.0.0";

export function getPleskPort(value: string | undefined): number {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    throw new Error("INVALID_PORT: Passenger did not provide PORT.");
  }
  const port = Number(normalized);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("INVALID_PORT: Passenger provided an invalid PORT.");
  }
  return port;
}

export function listenOnPleskPort(app: Pick<Express, "listen">, port: number): Server {
  return app.listen(port, PLESK_LISTEN_HOST);
}
