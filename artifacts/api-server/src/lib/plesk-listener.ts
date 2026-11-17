import type { Express } from "express";
import type { Server } from "node:http";

export const PLESK_LISTEN_HOST = "0.0.0.0";

export function getPleskPort(value: string | undefined): number {
  const normalized = value?.trim() ?? "";
  const port = Number(normalized);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65535 ? port : 3000;
}

export function listenOnPleskPort(app: Pick<Express, "listen">, port: number): Server {
  return app.listen(port, PLESK_LISTEN_HOST);
}
