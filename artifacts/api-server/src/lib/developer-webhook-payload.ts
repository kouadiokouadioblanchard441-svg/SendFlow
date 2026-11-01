import {
  decryptSensitiveData,
  encryptSensitiveData,
} from "./sensitive-data-crypto.ts";

const MAX_PLAINTEXT_BYTES = 8_192;
const CIPHERTEXT_PREFIX = "sfenc-v1.";
const ENCRYPTED_PAYLOAD_KEY = "__sendflow_encrypted_payload";
const ALLOWED_EVENT_TYPES = new Set(["payment.succeeded", "payment.failed"]);

export type DeveloperWebhookPayload = {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  createdAt: string;
  data: {
    sessionId: string;
    merchantReference: string;
    attemptId: string;
    transactionId: string;
    amountMinor: number;
    currency: string;
    status: "succeeded" | "failed";
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPayload(value: unknown): value is DeveloperWebhookPayload {
  if (!isRecord(value) || !isRecord(value.data)) return false;
  const { id, type, createdAt, data } = value;
  return typeof id === "string"
    && id.length > 0
    && typeof type === "string"
    && ALLOWED_EVENT_TYPES.has(type)
    && typeof createdAt === "string"
    && !Number.isNaN(Date.parse(createdAt))
    && typeof data.sessionId === "string"
    && typeof data.merchantReference === "string"
    && typeof data.attemptId === "string"
    && typeof data.transactionId === "string"
    && Number.isSafeInteger(data.amountMinor)
    && (data.amountMinor as number) > 0
    && typeof data.currency === "string"
    && data.currency.length === 3
    && data.status === (type === "payment.succeeded" ? "succeeded" : "failed");
}

/**
 * Stores the serialized financial webhook event as authenticated ciphertext.
 * The database JSONB field contains only this opaque string for new deliveries.
 */
export function encryptDeveloperWebhookPayload(
  payload: DeveloperWebhookPayload,
): Record<typeof ENCRYPTED_PAYLOAD_KEY, string> {
  if (!isValidPayload(payload)) {
    throw new TypeError("Invalid developer webhook payload");
  }
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, "utf8") > MAX_PLAINTEXT_BYTES) {
    throw new RangeError("Developer webhook payload exceeds the supported size");
  }
  return {
    [ENCRYPTED_PAYLOAD_KEY]: encryptSensitiveData(serialized, "developer-webhook-payload"),
  };
}

/**
 * Reads encrypted deliveries and safely supports pre-encryption object rows
 * while they remain in the outbox. Legacy objects are validated before use.
 */
export function decryptDeveloperWebhookPayload(value: unknown): DeveloperWebhookPayload {
  let payload: unknown = value;
  if (isRecord(value) && Object.keys(value).length === 1
    && typeof value[ENCRYPTED_PAYLOAD_KEY] === "string") {
    const encrypted = value[ENCRYPTED_PAYLOAD_KEY] as string;
    if (!encrypted.startsWith(CIPHERTEXT_PREFIX)) {
      throw new Error("Unsupported developer webhook payload format");
    }
    const plaintext = decryptSensitiveData(encrypted, "developer-webhook-payload");
    if (Buffer.byteLength(plaintext, "utf8") > MAX_PLAINTEXT_BYTES) {
      throw new RangeError("Developer webhook payload exceeds the supported size");
    }
    payload = JSON.parse(plaintext);
  } else if (typeof value === "string") {
    throw new Error("Unsupported developer webhook payload format");
  }
  if (!isValidPayload(payload)) {
    throw new Error("Invalid developer webhook payload");
  }
  return payload;
}
