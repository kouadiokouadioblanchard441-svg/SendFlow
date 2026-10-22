import { BlockList, isIP } from "node:net";
import type { IncomingMessage } from "node:http";

/** One host only: never accept ports, CIDRs, zone identifiers or hostnames. */
export function normalizeIp(value: string | undefined): string | null {
  if (!value || value !== value.trim() || value.includes("%") || value.length > 45) return null;
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // IPv4-mapped IPv6 must share the IPv4 block, regardless of spelling.
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/i.exec(canonical);
  if (mapped) {
    const a = parseInt(mapped[1], 16), b = parseInt(mapped[2], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return canonical;
}

const infrastructure = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) infrastructure.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) infrastructure.addSubnet(address, prefix, "ipv6");

export function isBlockableIp(value: string): boolean {
  const ip = normalizeIp(value);
  return ip !== null && !infrastructure.check(ip, isIP(ip) === 4 ? "ipv4" : "ipv6");
}

export function trustedProxyHops(value: string | undefined, nodeEnvironment = "development"): number {
  if (value === undefined || value.trim() === "") {
    if (nodeEnvironment === "production") throw new Error("TRUST_PROXY_HOPS must be explicitly configured in production");
    return 1;
  }
  if (!/^(0|[1-9]\d*)$/.test(value.trim()) || Number(value) > 16) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 16");
  }
  return Number(value);
}

/** Same right-to-left hop model as Express. Never trust the leftmost header blindly.
 * Production must firewall the origin so clients cannot bypass the expected proxy.
 */
export function requestIp(req: IncomingMessage, hops: number): string | null {
  const peer = normalizeIp(req.socket.remoteAddress);
  if (!peer) return null;
  if (hops === 0) return peer;
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded === undefined) return peer;
  if (typeof forwarded !== "string" || forwarded.length > 4096) return null;
  const addresses = forwarded.split(",").map((part) => part.trim());
  if (addresses.length > 32) return null;
  const chain = [peer, ...addresses.reverse()];
  return normalizeIp(chain[Math.min(hops, chain.length - 1)]);
}
