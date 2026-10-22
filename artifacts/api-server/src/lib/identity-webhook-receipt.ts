import { createSensitiveDataLookupIndex, encryptSensitiveData } from "./sensitive-data-crypto.ts";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

/** Preserve the authenticated message encrypted, never in application logs. */
export function prepareIdentityWebhookReceipt(payload: unknown) {
  const canonical = JSON.stringify(canonicalize(payload));
  if (canonical === undefined) throw new TypeError("Invalid webhook receipt");
  // Didit refreshes dispatch timestamp on retries; created_at is the signed
  // underlying update time and MUST stay in the semantic idempotency digest.
  const semanticPayload = { ...(payload as Record<string, unknown>) };
  delete semanticPayload.timestamp;
  return {
    payloadDigest: createSensitiveDataLookupIndex(
      JSON.stringify(canonicalize(semanticPayload)), "identity-webhook-payload",
    ),
    encryptedPayload: encryptSensitiveData(canonical, "identity-webhook-payload"),
  };
}

export function getDiditRecordUpdateTime(payload: unknown, now = Date.now()): Date | null {
  const seconds = (payload as Record<string, unknown> | null)?.created_at;
  return typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0
    && seconds <= Math.floor(now / 1000) + 300 ? new Date(seconds * 1000) : null;
}
