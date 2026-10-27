import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeveloperApiKeyMaterial,
  deriveDeveloperAttemptIdempotencyKey,
  hashDeveloperPublicKey,
  hashDeveloperRequest,
  hashDeveloperSecretKey,
  isPublicWebhookAddress,
} from "./developer-api-security.ts";

test("API key material uses separate, high-entropy public and secret credentials", () => {
  const keys = createDeveloperApiKeyMaterial();
  assert.match(keys.publicKey, /^sfpk_live_[A-Za-z0-9_-]{43}$/);
  assert.match(keys.secretKey, /^sfsk_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(keys.publicKeyPrefix, keys.publicKey.slice(0, 19));
  assert.equal(keys.secretKeyPrefix, keys.secretKey.slice(0, 19));
  assert.notEqual(keys.publicKeyHash, keys.secretKeyHash);
  assert.notEqual(keys.publicKeyHash, keys.publicKey);
  assert.notEqual(keys.secretKeyHash, keys.secretKey);
  assert.notEqual(hashDeveloperPublicKey(keys.publicKey), hashDeveloperSecretKey(keys.publicKey));
});

test("developer request hashes ignore object key order but preserve values", () => {
  assert.equal(
    hashDeveloperRequest({ currency: "XOF", amountMinor: 2000, metadata: { b: 2, a: 1 } }),
    hashDeveloperRequest({ metadata: { a: 1, b: 2 }, amountMinor: 2000, currency: "XOF" }),
  );
  assert.notEqual(
    hashDeveloperRequest({ amountMinor: 2000 }),
    hashDeveloperRequest({ amountMinor: 2001 }),
  );
});

test("direct-attempt idempotency keys are stable UUIDs scoped to a session", () => {
  const first = deriveDeveloperAttemptIdempotencyKey(
    "11111111-1111-4111-8111-111111111111",
    "merchant-order-123",
  );
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(first, deriveDeveloperAttemptIdempotencyKey(
    "11111111-1111-4111-8111-111111111111",
    "merchant-order-123",
  ));
  assert.notEqual(first, deriveDeveloperAttemptIdempotencyKey(
    "22222222-2222-4222-8222-222222222222",
    "merchant-order-123",
  ));
});

test("webhook address checks reject local, private, reserved, and documentation ranges", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.10.20",
    "192.168.1.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicWebhookAddress(address), false, address);
  }
  assert.equal(isPublicWebhookAddress("8.8.8.8"), true);
  assert.equal(isPublicWebhookAddress("2606:4700:4700::1111"), true);
});
