import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type DeveloperApiKeyMaterial = {
  publicKey: string;
  publicKeyPrefix: string;
  publicKeyHash: string;
  secretKey: string;
  secretKeyPrefix: string;
  secretKeyHash: string;
};

function tokenHash(kind: "public" | "secret" | "client", token: string) {
  return createHash("sha256")
    .update(`sendflow:developer:${kind}:v1\0`, "utf8")
    .update(token, "utf8")
    .digest("hex");
}

export function createDeveloperApiKeyMaterial(): DeveloperApiKeyMaterial {
  const publicKey = `sfpk_live_${randomBytes(32).toString("base64url")}`;
  const secretKey = `sfsk_live_${randomBytes(32).toString("base64url")}`;
  return {
    publicKey,
    publicKeyPrefix: publicKey.slice(0, 19),
    publicKeyHash: tokenHash("public", publicKey),
    secretKey,
    secretKeyPrefix: secretKey.slice(0, 19),
    secretKeyHash: tokenHash("secret", secretKey),
  };
}

export function hashDeveloperPublicKey(value: string) {
  return tokenHash("public", value);
}

export function hashDeveloperSecretKey(value: string) {
  return tokenHash("secret", value);
}

export function createDeveloperClientToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDeveloperClientToken(value: string) {
  return tokenHash("client", value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function hashDeveloperRequest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

export function deriveDeveloperAttemptIdempotencyKey(sessionId: string, idempotencyKey: string) {
  const bytes = createHash("sha256")
    .update(`sendflow:developer-attempt:v1\0${sessionId}\0${idempotencyKey}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isPublicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets as [number, number, number, number];
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
  );
}

function expandIpv6(address: string): number[] | null {
  let value = address.toLowerCase().split("%", 1)[0] ?? "";
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = value.slice(lastColon + 1);
    if (!isPublicIpv4(ipv4)) return null;
    const octets = ipv4.split(".").map(Number);
    const encoded = `${((octets[0]! << 8) | octets[1]!).toString(16)}:${((octets[2]! << 8) | octets[3]!).toString(16)}`;
    value = `${value.slice(0, lastColon + 1)}${encoded}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right].map((part) => Number.parseInt(part, 16));
  return groups.length === 8 && groups.every((part) => Number.isInteger(part) && part >= 0 && part <= 0xffff)
    ? groups
    : null;
}

export function isPublicWebhookAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const groups = expandIpv6(address);
  if (!groups) return false;
  const first = groups[0]!;
  // Permit only global-unicast 2000::/3, excluding documentation, transition,
  // and embedded-address ranges that can tunnel to private IPv4 destinations.
  if ((first & 0xe000) !== 0x2000) return false;
  if (first === 0x2001 && (groups[1] === 0x0db8 || groups[1] === 0 || (groups[1]! & 0xfff0) === 0x0020)) return false;
  if (first === 0x2002) return false;
  return true;
}

export async function resolvePublicWebhookTarget(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Webhook URL must be a valid HTTPS address");
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
    || (url.port && url.port !== "443")
    || isIP(url.hostname) !== 0
    || ["localhost", "localhost.", "local", "internal", "test", "invalid"].some((suffix) =>
      url.hostname.toLowerCase() === suffix || url.hostname.toLowerCase().endsWith(`.${suffix}`))
  ) {
    throw new Error("Webhook URL is not allowed");
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  const answers = await lookup(host, { all: true, verbatim: true });
  if (!answers.length || answers.some((answer) => !isPublicWebhookAddress(answer.address))) {
    throw new Error("Webhook host does not resolve exclusively to public addresses");
  }
  return {
    url: url.toString(),
    hostname: host,
    address: answers[0]!.address,
    family: answers[0]!.family as 4 | 6,
  };
}
