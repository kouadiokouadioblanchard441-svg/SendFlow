import { createHash } from "node:crypto";

const ACTION_PATH_PATTERN = /^\/[A-Za-z0-9][A-Za-z0-9/_-]{0,120}$/u;

function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid action payload");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  throw new Error("Invalid action payload");
}

export function adminActionKey(method: string, path: string): string | null {
  const normalizedMethod = method.toUpperCase();
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)
    || !ACTION_PATH_PATTERN.test(path)
    || path.startsWith("/sign-in")
    || path.startsWith("/sign-out")
    || path.startsWith("/refresh")
    || path.startsWith("/step-up")
  ) return null;
  return `${normalizedMethod}:${path}`;
}

export function hashAdminActionPayload(query: unknown, body: unknown): string {
  return createHash("sha256")
    .update(stableJson({ query: query ?? {}, body: body ?? null }), "utf8")
    .digest("hex");
}

export function issueableAdminAction(
  action: unknown,
  query: unknown,
  body: unknown,
): { actionKey: string; payloadHash: string } | null {
  if (typeof action !== "string" || action.length > 128) return null;
  const separator = action.indexOf(":");
  if (separator < 1 || action.indexOf(":", separator + 1) !== -1) return null;
  const method = action.slice(0, separator);
  const path = action.slice(separator + 1);
  const actionKey = adminActionKey(method, path);
  if (!actionKey || actionKey !== `${method.toUpperCase()}:${path}`) return null;
  try {
    return { actionKey, payloadHash: hashAdminActionPayload(query, body) };
  } catch {
    return null;
  }
}
