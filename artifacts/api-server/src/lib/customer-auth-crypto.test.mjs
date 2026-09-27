import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomerSessionToken,
  hashCustomerSecret,
  hashCustomerSessionToken,
  isCustomerSessionToken,
  verifyCustomerSecret,
} from "./customer-auth-crypto.ts";

test("customer secrets are salted and verified without storing plaintext", async () => {
  const secret = "sample-customer-secret-123";
  const encodedHash = await hashCustomerSecret(secret);

  assert.match(encodedHash, /^scrypt\$v1\$32768\$8\$1\$/);
  assert.notEqual(encodedHash, secret);
  assert.equal(await verifyCustomerSecret(secret, encodedHash), true);
  assert.equal(await verifyCustomerSecret("different-secret", encodedHash), false);
});

test("malformed customer secret hashes fail closed", async () => {
  assert.equal(await verifyCustomerSecret("secret", ""), false);
  assert.equal(await verifyCustomerSecret("secret", "scrypt$v1$1$1$1$bad$hash"), false);
});

test("customer session tokens are random bearer values stored as one-way hashes", () => {
  const firstToken = createCustomerSessionToken();
  const secondToken = createCustomerSessionToken();

  assert.equal(isCustomerSessionToken(firstToken), true);
  assert.equal(isCustomerSessionToken(secondToken), true);
  assert.notEqual(firstToken, secondToken);
  assert.match(hashCustomerSessionToken(firstToken), /^[a-f0-9]{64}$/);
  assert.notEqual(hashCustomerSessionToken(firstToken), firstToken);
  assert.equal(isCustomerSessionToken(`${firstToken}x`), false);
  assert.equal(isCustomerSessionToken(`${firstToken.slice(0, -1)}!`), false);
});