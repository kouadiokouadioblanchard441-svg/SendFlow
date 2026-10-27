import assert from "node:assert/strict";
import test from "node:test";
import { createDeveloperApiKeyMaterial } from "./developer-api-security.ts";

test("sandbox key pairs use non-live prefixes and high-entropy independent values", () => {
  const keys = createDeveloperApiKeyMaterial("test");

  assert.match(keys.publicKey, /^sfpk_test_[A-Za-z0-9_-]{43}$/);
  assert.match(keys.secretKey, /^sfsk_test_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(keys.publicKey, keys.secretKey);
  assert.notEqual(keys.publicKeyHash, keys.publicKey);
  assert.notEqual(keys.secretKeyHash, keys.secretKey);
  assert.equal(keys.publicKeyPrefix, keys.publicKey.slice(0, 19));
  assert.equal(keys.secretKeyPrefix, keys.secretKey.slice(0, 19));
});
