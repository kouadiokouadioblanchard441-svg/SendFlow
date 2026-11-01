import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptDeveloperWebhookPayload,
  encryptDeveloperWebhookPayload,
} from "./developer-webhook-payload.ts";
import {
  decryptSensitiveData,
  encryptSensitiveData,
} from "./sensitive-data-crypto.ts";

const originalKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;

test.before(() => {
  process.env.CUSTOMER_PII_ENCRYPTION_KEY = "test-only-secret-key-with-more-than-32-bytes";
});

test.after(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  else process.env.CUSTOMER_PII_ENCRYPTION_KEY = originalKey;
});

const samplePayload = {
  id: "d9d9e866-80d7-4e8a-88be-212c2fda5f91",
  type: "payment.succeeded",
  createdAt: "2026-11-02T12:00:00.000Z",
  data: {
    sessionId: "a63a370a-63d7-4a44-9aca-f18f50470475",
    merchantReference: "merchant-order-456",
    attemptId: "4fbc5c61-dbe4-4d54-bdbe-7d1ea14d3330",
    transactionId: "4daaf6b2-cd68-4a29-b87f-77fc628fd924",
    amountMinor: 12_500,
    currency: "XOF",
    status: "succeeded",
  },
};
const context = {
  deliveryId: samplePayload.id,
  eventType: samplePayload.type,
};

test("new financial webhook payloads are context-bound, opaque and canonical", () => {
  const encrypted = encryptDeveloperWebhookPayload(samplePayload, context);
  const ciphertext = encrypted.__sendflow_encrypted_payload;
  assert.match(ciphertext, /^sfenc-v2\.primary\./);
  assert.equal(JSON.stringify(encrypted).includes(samplePayload.data.merchantReference), false);
  assert.deepEqual(decryptDeveloperWebhookPayload(encrypted, context), samplePayload);
});

test("legacy plaintext and prior v1 encrypted rows normalize under strict validation", () => {
  assert.deepEqual(decryptDeveloperWebhookPayload(samplePayload, context), samplePayload);
  const previousV1 = {
    __sendflow_encrypted_payload: encryptSensitiveData(
      JSON.stringify(samplePayload),
      "developer-webhook-payload",
    ),
  };
  assert.deepEqual(decryptDeveloperWebhookPayload(previousV1, context), samplePayload);
});

test("wrong context, purpose, key version and ciphertext tampering fail closed", () => {
  const encrypted = encryptDeveloperWebhookPayload(samplePayload, context);
  const encoded = encrypted.__sendflow_encrypted_payload;
  assert.throws(() => decryptSensitiveData(
    encoded,
    "developer-webhook-payload",
    { authenticatedContext: JSON.stringify(["another-id", context.eventType]) },
  ));
  assert.throws(() => decryptDeveloperWebhookPayload(encrypted, {
    ...context,
    deliveryId: "293a7ce5-4c47-4de7-97ac-55fddc161810",
  }));
  assert.throws(() => decryptDeveloperWebhookPayload(encrypted, {
    ...context,
    eventType: "payment.failed",
  }));
  assert.throws(() => decryptSensitiveData(
    encoded,
    "developer-webhook-secret",
    { authenticatedContext: JSON.stringify([context.deliveryId, context.eventType]) },
  ));
  const parts = encoded.split(".");
  parts[4] = `${parts[4]}A`;
  assert.throws(() => decryptDeveloperWebhookPayload({
    __sendflow_encrypted_payload: parts.join("."),
  }, context));
  const wrongPurposeCiphertext = encryptSensitiveData(
    JSON.stringify(samplePayload),
    "developer-webhook-secret",
  );
  assert.throws(() => decryptDeveloperWebhookPayload({
    __sendflow_encrypted_payload: wrongPurposeCiphertext,
  }, context));
});

test("unknown, missing, malformed, mismatched and unexpected fields are rejected", () => {
  assert.throws(() => decryptDeveloperWebhookPayload("not-encrypted", context));
  assert.throws(() => decryptDeveloperWebhookPayload({ ...samplePayload, type: "payment.refunded" }, context));
  assert.throws(() => decryptDeveloperWebhookPayload({ ...samplePayload, extra: "do-not-send" }, context));
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: { ...samplePayload.data, internalSecret: "do-not-send" },
  }, context));
  const { transactionId: _transactionId, ...missingTransaction } = samplePayload.data;
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: missingTransaction,
  }, context));
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: { ...samplePayload.data, amountMinor: "12500" },
  }, context));
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: { ...samplePayload.data, currency: "XAF" },
  }, context));
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: { ...samplePayload.data, amountMinor: -1 },
  }, context));
  assert.throws(() => encryptDeveloperWebhookPayload({
    ...samplePayload,
    type: "payment.failed",
  }, context));
  assert.throws(() => encryptDeveloperWebhookPayload({
    ...samplePayload,
    extra: "do-not-persist",
  }, context));
});
