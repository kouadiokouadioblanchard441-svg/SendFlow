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
  id: "delivery-123",
  type: "payment.succeeded",
  createdAt: "2026-11-02T12:00:00.000Z",
  data: {
    sessionId: "session-123",
    merchantReference: "merchant-order-456",
    attemptId: "attempt-789",
    transactionId: "transaction-987",
    amountMinor: 12_500,
    currency: "XOF",
    status: "succeeded",
  },
};

test("new financial webhook outbox payloads are opaque and decrypt exactly", () => {
  const encrypted = encryptDeveloperWebhookPayload(samplePayload);
  const ciphertext = encrypted.__sendflow_encrypted_payload;
  assert.match(ciphertext, /^sfenc-v1\./);
  assert.equal(JSON.stringify(encrypted).includes(samplePayload.data.merchantReference), false);
  assert.deepEqual(decryptDeveloperWebhookPayload(encrypted), samplePayload);
});

test("legacy JSONB object payloads remain readable during migration", () => {
  assert.deepEqual(decryptDeveloperWebhookPayload(samplePayload), samplePayload);
});

test("wrong purpose and ciphertext tampering fail closed", () => {
  const encrypted = encryptDeveloperWebhookPayload(samplePayload);
  const encoded = encrypted.__sendflow_encrypted_payload;
  assert.throws(() => decryptSensitiveData(encoded, "developer-webhook-secret"));
  const parts = encoded.split(".");
  parts[3] = `${parts[3]}A`;
  assert.throws(() => decryptDeveloperWebhookPayload(parts.join(".")));
  const wrongPurposeCiphertext = encryptSensitiveData(
    JSON.stringify(samplePayload),
    "developer-webhook-secret",
  );
  assert.throws(() => decryptDeveloperWebhookPayload({
    __sendflow_encrypted_payload: wrongPurposeCiphertext,
  }));
});

test("malformed, unsupported, and invalid event payloads are rejected", () => {
  assert.throws(() => decryptDeveloperWebhookPayload("not-encrypted"));
  assert.throws(() => decryptDeveloperWebhookPayload({ ...samplePayload, type: "payment.refunded" }));
  assert.throws(() => decryptDeveloperWebhookPayload({
    ...samplePayload,
    data: { ...samplePayload.data, amountMinor: -1 },
  }));
  assert.throws(() => encryptDeveloperWebhookPayload({
    ...samplePayload,
    type: "payment.failed",
  }));
});
