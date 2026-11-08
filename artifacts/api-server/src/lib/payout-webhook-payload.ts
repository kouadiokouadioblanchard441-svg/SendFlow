import { decryptSensitiveData, encryptSensitiveData } from "./sensitive-data-crypto.ts";

const EVENT_TYPES = new Set([
  "payout.created",
  "payout.processing",
  "payout.succeeded",
  "payout.failed",
  "payout.uncertain",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS = [
  "amountMinor", "beneficiaryAmountMinor", "countryCode", "currency", "feeMinor",
  "feePayer", "merchantReference", "operatorId", "payoutId",
  "reference", "status", "totalDebitMinor",
];
const ENVELOPE_KEY = "__sendflow_encrypted_payload";

export type PayoutWebhookEventType =
  | "payout.created"
  | "payout.processing"
  | "payout.succeeded"
  | "payout.failed"
  | "payout.uncertain";
export type PayoutWebhookPayload = {
  id: string;
  type: PayoutWebhookEventType;
  createdAt: string;
  data: {
    amountMinor: number;
    beneficiaryAmountMinor: number;
    countryCode: string;
    currency: "XOF";
    feeMinor: number;
    feePayer: "merchant" | "beneficiary";
    merchantReference: string | null;
    operatorId: string;
    payoutId: string;
    reference: string;
    status: "funds_reserved" | "submitted" | "processing" | "succeeded" | "failed" | "rejected" | "cancelled" | "uncertain";
    totalDebitMinor: number;
  };
};

export class PayoutWebhookPayloadError extends Error {
  constructor() {
    super("Payout webhook payload is invalid");
    this.name = "PayoutWebhookPayloadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, i) => key === expected[i]);
}

function context(deliveryId: string, eventType: PayoutWebhookEventType) {
  return JSON.stringify([deliveryId, eventType]);
}

export function normalizePayoutWebhookPayload(value: unknown): PayoutWebhookPayload {
  if (!isRecord(value) || !exactKeys(value, ["createdAt", "data", "id", "type"])
    || !isRecord(value.data) || !exactKeys(value.data, KEYS)) {
    throw new PayoutWebhookPayloadError();
  }
  const { createdAt, id, type, data } = value;
  if (typeof id !== "string" || !UUID.test(id)
    || typeof type !== "string" || !EVENT_TYPES.has(type)
    || typeof createdAt !== "string") throw new PayoutWebhookPayloadError();
  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString() !== createdAt) {
    throw new PayoutWebhookPayloadError();
  }
  const {
    amountMinor, beneficiaryAmountMinor, countryCode, currency, feeMinor, feePayer,
    merchantReference, operatorId, payoutId, reference, status, totalDebitMinor,
  } = data;
  const statuses: Record<string, string[]> = {
    "payout.created": ["funds_reserved"],
    "payout.processing": ["submitted", "processing"],
    "payout.succeeded": ["succeeded"],
    "payout.failed": ["failed", "rejected", "cancelled"],
    "payout.uncertain": ["uncertain"],
  };
  const integers = [amountMinor, beneficiaryAmountMinor, feeMinor, totalDebitMinor];
  if (!integers.every((item) => Number.isSafeInteger(item))
    || (amountMinor as number) < 1 || (beneficiaryAmountMinor as number) < 1
    || (feeMinor as number) < 0 || (totalDebitMinor as number) < 1
    || (feePayer !== "merchant" && feePayer !== "beneficiary")
    || currency !== "XOF"
    || typeof countryCode !== "string" || !/^[a-z]{2}$/.test(countryCode)
    || typeof operatorId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(operatorId)
    || typeof payoutId !== "string" || !UUID.test(payoutId)
    || typeof reference !== "string" || !/^SFPO[A-F0-9]{16}$/.test(reference)
    || (merchantReference !== null && (typeof merchantReference !== "string"
      || merchantReference.trim().length < 1 || merchantReference.length > 128
      || /[\u0000-\u001f\u007f]/.test(merchantReference)))
    || !statuses[type]?.includes(String(status))
    || (feePayer === "merchant" && (
      totalDebitMinor !== (amountMinor as number) + (feeMinor as number)
      || beneficiaryAmountMinor !== amountMinor
    ))
    || (feePayer === "beneficiary" && (
      totalDebitMinor !== amountMinor
      || beneficiaryAmountMinor !== (amountMinor as number) - (feeMinor as number)
    ))) {
    throw new PayoutWebhookPayloadError();
  }
  return {
    id,
    type: type as PayoutWebhookEventType,
    createdAt,
    data: {
      amountMinor: amountMinor as number,
      beneficiaryAmountMinor: beneficiaryAmountMinor as number,
      countryCode,
      currency: "XOF",
      feeMinor: feeMinor as number,
      feePayer,
      merchantReference: merchantReference as string | null,
      operatorId,
      payoutId,
      reference,
      status: status as PayoutWebhookPayload["data"]["status"],
      totalDebitMinor: totalDebitMinor as number,
    },
  };
}

export function encryptPayoutWebhookPayload(
  payload: PayoutWebhookPayload,
  deliveryId: string,
) {
  const normalized = normalizePayoutWebhookPayload(payload);
  if (!UUID.test(deliveryId) || normalized.id !== deliveryId) throw new PayoutWebhookPayloadError();
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, "utf8") > 8_192) throw new PayoutWebhookPayloadError();
  return {
    [ENVELOPE_KEY]: encryptSensitiveData(serialized, "developer-webhook-payload", {
      authenticatedContext: context(deliveryId, normalized.type),
    }),
  };
}

export function decryptPayoutWebhookPayload(
  value: unknown,
  contextValue: { deliveryId: string; eventType: PayoutWebhookEventType },
): PayoutWebhookPayload {
  if (!UUID.test(contextValue.deliveryId) || !EVENT_TYPES.has(contextValue.eventType)
    || !isRecord(value) || !exactKeys(value, [ENVELOPE_KEY])
    || typeof value[ENVELOPE_KEY] !== "string") {
    throw new PayoutWebhookPayloadError();
  }
  try {
    const parsed = JSON.parse(decryptSensitiveData(
      value[ENVELOPE_KEY] as string,
      "developer-webhook-payload",
      { authenticatedContext: context(contextValue.deliveryId, contextValue.eventType) },
    ));
    const normalized = normalizePayoutWebhookPayload(parsed);
    if (normalized.id !== contextValue.deliveryId || normalized.type !== contextValue.eventType) {
      throw new PayoutWebhookPayloadError();
    }
    return normalized;
  } catch {
    throw new PayoutWebhookPayloadError();
  }
}
