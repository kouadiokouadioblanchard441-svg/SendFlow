// Server-only entry point. Never import this module into browser source.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { QueryConfig } from "pg";
import { pool } from "./client.ts";
import { normalizeIp, requestIp, trustedProxyHops } from "./ip-access-policy.ts";
import { evaluateNetworkDefense } from "./network-defense.ts";

export { normalizeIp, isBlockableIp, requestIp, trustedProxyHops } from "./ip-access-policy.ts";

export async function isIpBlocked(ip: string): Promise<boolean> {
  const normalized = normalizeIp(ip);
  if (!normalized) throw new Error("Invalid network address");
  // No allow-cache: a committed block applies to the next origin request on every process.
  const query: QueryConfig & { query_timeout: number } = {
    text: "SELECT 1 FROM public.sf_ip_blocklist WHERE ip_address = $1 AND revoked_at IS NULL LIMIT 1",
    values: [normalized],
    query_timeout: 2000,
  };
  const result = await pool.query(query);
  return result.rowCount !== 0;
}

export async function enforceIpAccess(
  req: IncomingMessage, res: ServerResponse,
  lookup: (ip: string) => Promise<boolean> = isIpBlocked,
  hops = trustedProxyHops(process.env.TRUST_PROXY_HOPS, process.env.NODE_ENV),
): Promise<boolean> {
  const deny = (status: number, message: string) => {
    res.statusCode = status;
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(message);
    return false;
  };
  const ip = requestIp(req, hops);
  if (!ip) return deny(403, "Accès refusé.");
  try {
    if (await lookup(ip)) return deny(403, "Accès refusé.");
    const decision = await evaluateNetworkDefense(req, ip);
    if (!decision.allowed) {
      return deny(decision.status, "Accès refusé.");
    }
    return true;
  } catch {
    // Never turn a missing table/DB outage into an implicit permission.
    return deny(503, "Service temporairement indisponible.");
  }
}
