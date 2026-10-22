import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { prepareIdentityWebhookReceipt, getDiditRecordUpdateTime } from "./identity-webhook-receipt.ts";
import { decryptSensitiveData } from "./sensitive-data-crypto.ts";

test("Didit retries may refresh dispatch time but cannot alter semantic payload under the same event", () => {
  const saved = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  process.env.CUSTOMER_PII_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  try {
    const body = { event_id: "fixture", created_at: 1_700_000_000, timestamp: 1_700_000_001, status: "In Review" };
    const first = prepareIdentityWebhookReceipt(body);
    const retry = prepareIdentityWebhookReceipt({ ...body, timestamp: body.timestamp + 10 });
    assert.equal(first.payloadDigest, retry.payloadDigest);
    assert.notEqual(first.encryptedPayload, retry.encryptedPayload);
    assert.notEqual(first.payloadDigest, prepareIdentityWebhookReceipt({ ...body, status: "Approved" }).payloadDigest);
    assert.notEqual(first.payloadDigest, prepareIdentityWebhookReceipt({ ...body, created_at: body.created_at + 1 }).payloadDigest);
    assert.deepEqual(JSON.parse(decryptSensitiveData(first.encryptedPayload, "identity-webhook-payload")), body);
  } finally {
    if (saved === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
    else process.env.CUSTOMER_PII_ENCRYPTION_KEY = saved;
  }
});
test("provider ordering uses valid signed record time, never a retry dispatch time", () => {
  const now = 1_700_000_000_000;
  assert.equal(getDiditRecordUpdateTime({ created_at: now / 1000 }, now)?.getTime(), now);
  for (const created_at of [undefined, null, "1700000000", 1.5, -1, now / 1000 + 301]) {
    assert.equal(getDiditRecordUpdateTime({ created_at, timestamp: now / 1000 }, now), null);
  }
});
