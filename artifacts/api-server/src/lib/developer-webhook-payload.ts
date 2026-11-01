import {
  decryptSensitiveData,
  encryptSensitiveData,
} from "./sensitive-data-crypto.ts";

const MAX_PLAINTEXT_BYTES = 8_192;
const V1_CIPHERTEXT_PREFIX = "sfenc-v1.";
const V2_CIPHERTEXT_PREFIX = "sfenc-v2.";
const ENCRYPTED_PAYLOAD_KEY = "__sendflow_encrypted_payload";
const ALLOWED_EVENT_TYPES = new Set(["payment.succeeded", "payment.failed"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOP_LEVEL_KEYS = ["createdAt", "data", "id", "type"];
const DATA_KEYS = [
  "amountMinor",
  "attemptId",
  "currency",
  "merchantReference",
  "sessionId",
  "status",
  "transactionId",
];

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

export type DeveloperWebhookPayloadContext = {
  deliveryId: string;
  eventType: DeveloperWebhookPayload["type"];
};

export class DeveloperWebhookPayloadError extends Error {
  readonly code = "payload_invalid";

  constructor() {
    super("Developer webhook payload is invalid");
    this.name = "DeveloperWebhookPayloadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  return actual.length === orderedExpected.length
    && actual.every((key, index) => key === orderedExpected[index]);
}

function authenticatedContext(context: DeveloperWebhookPayloadContext) {
  return JSON.stringify([context.deliveryId, context.eventType]);
}

/**
 * Strictly validates a stored or newly generated event and returns a canonical
 * object containing only the fields in the public webhook contract.
 */
export function normalizeDeveloperWebhookPayload(
  value: unknown,
): DeveloperWebhookPayload {
  if (!isRecord(value) || !hasExactKeys(value, TOP_LEVEL_KEYS) || !isRecord(value.data)
    || !hasExactKeys(value.data, DATA_KEYS)) {
    throw new DeveloperWebhookPayloadError();
  }

  const { id, type, createdAt, data } = value;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)
    || typeof type !== "string" || !ALLOWED_EVENT_TYPES.has(type)
    || typeof createdAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt)) {
    throw new DeveloperWebhookPayloadError();
  }
  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== createdAt) {
    throw new DeveloperWebhookPayloadError();
  }

  const expectedStatus = type === "payment.succeeded" ? "succeeded" : "failed";
  const { sessionId, merchantReference, attemptId, transactionId, amountMinor, currency, status } = data;
  if (typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId)
    || typeof attemptId !== "string" || !UUID_PATTERN.test(attemptId)
    || typeof transactionId !== "string" || !UUID_PATTERN.test(transactionId)
    || typeof merchantReference !== "string"
    || merchantReference.trim().length < 1
    || merchantReference.length > 128
    || /[\u0000-\u001f\u007f]/.test(merchantReference)
    || !Number.isSafeInteger(amountMinor)
    || (amountMinor as number) < 200
    || (amountMinor as number) > 2_000_000
    || currency !== "XOF"
    || status !== expectedStatus) {
    throw new DeveloperWebhookPayloadError();
  }

  return {
    id,
    type: type as DeveloperWebhookPayload["type"],
    createdAt,
    data: {
      sessionId,
      merchantReference,
      attemptId,
      transactionId,
      amountMinor: amountMinor as number,
      currency: currency as string,
      status: expectedStatus,
    },
  };
}

/**
 * Stores the canonical event as authenticated ciphertext. The context binds
 * the ciphertext to the stable outbox ID and event type.
 */
export function encryptDeveloperWebhookPayload(
  payload: DeveloperWebhookPayload,
  context: DeveloperWebhookPayloadContext,
): Record<typeof ENCRYPTED_PAYLOAD_KEY, string> {
  const canonical = normalizeDeveloperWebhookPayload(payload);
  if (!UUID_PATTERN.test(context.deliveryId)
    || canonical.id !== context.deliveryId
    || canonical.type !== context.eventType) {
    throw new DeveloperWebhookPayloadError();
  }
  const serialized = JSON.stringify(canonical);
  if (Buffer.byteLength(serialized, "utf8") > MAX_PLAINTEXT_BYTES) {
    throw new DeveloperWebhookPayloadError();
  }
  return {
    [ENCRYPTED_PAYLOAD_KEY]: encryptSensitiveData(
      serialized,
      "developer-webhook-payload",
      { authenticatedContext: authenticatedContext(context) },
    ),
  };
}

/**
 * Reads current context-bound envelopes, the short-lived prior v1 envelope,
 * and legacy plaintext JSONB rows. Every path is strictly normalized.
 */
export function decryptDeveloperWebhookPayload(
  value: unknown,
  context: DeveloperWebhookPayloadContext,
): DeveloperWebhookPayload {
  if (!UUID_PATTERN.test(context.deliveryId) || !ALLOWED_EVENT_TYPES.has(context.eventType)) {
    throw new DeveloperWebhookPayloadError();
  }
  let payload: unknown = value;
  if (isRecord(value) && hasExactKeys(value, [ENCRYPTED_PAYLOAD_KEY])
    && typeof value[ENCRYPTED_PAYLOAD_KEY] === "string") {
    const encrypted = value[ENCRYPTED_PAYLOAD_KEY] as string;
    try {
      if (encrypted.startsWith(V2_CIPHERTEXT_PREFIX)) {
        payload = JSON.parse(decryptSensitiveData(
          encrypted,
          "developer-webhook-payload",
          { authenticatedContext: authenticatedContext(context) },
        ));
      } else if (encrypted.startsWith(V1_CIPHERTEXT_PREFIX)) {
        // Compatibility for rows encrypted by the immediately preceding code.
        payload = JSON.parse(decryptSensitiveData(encrypted, "developer-webhook-payload"));
      } else {
        throw new Error("Unsupported envelope version");
      }
    } catch {
      throw new DeveloperWebhookPayloadError();
    }
  } else if (typeof value === "string") {
    throw new DeveloperWebhookPayloadError();
  }

  try {
    const canonical = normalizeDeveloperWebhookPayload(payload);
    if (canonical.id !== context.deliveryId || canonical.type !== context.eventType
      || Buffer.byteLength(JSON.stringify(canonical), "utf8") > MAX_PLAINTEXT_BYTES) {
      throw new DeveloperWebhookPayloadError();
    }
    return canonical;
  } catch {
    throw new DeveloperWebhookPayloadError();
  }
}
