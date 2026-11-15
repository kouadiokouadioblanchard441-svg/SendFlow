import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomerSessionToken,
  hashCustomerPassword,
  hashCustomerSecret,
  hashCustomerSessionToken,
  isCustomerPasswordArgon2idHash,
  isCustomerSessionToken,
  verifyCustomerPassword,
  verifyCustomerSecret,
} from "./customer-auth-crypto.ts";

test("customer PINs remain salted scrypt hashes", async () => {
  const secret = "sample-customer-pin-123";
  const encodedHash = await hashCustomerSecret(secret);

  assert.match(encodedHash, /^scrypt\$v1\$32768\$8\$1\$/);
  assert.notEqual(encodedHash, secret);
  assert.equal(await verifyCustomerSecret(secret, encodedHash), true);
  assert.equal(await verifyCustomerSecret("different-secret", encodedHash), false);
});

test("customer passwords use salted Argon2id and legacy scrypt remains verifiable for sign-in upgrades", async () => {
  const password = "Example-customer-password-123";
  const firstHash = await hashCustomerPassword(password);
  const secondHash = await hashCustomerPassword(password);

  assert.match(firstHash, /^\$argon2id\$v=19\$/);
  assert.notEqual(firstHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.equal(isCustomerPasswordArgon2idHash(firstHash), true);
  assert.equal(await verifyCustomerPassword(password, firstHash), true);
  assert.equal(await verifyCustomerPassword("incorrect-password", firstHash), false);

  const legacyHash = await hashCustomerSecret(password);
  assert.equal(isCustomerPasswordArgon2idHash(legacyHash), false);
  assert.equal(await verifyCustomerPassword(password, legacyHash), true);
  assert.equal(await verifyCustomerPassword("incorrect-password", legacyHash), false);
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
  const productionHash = hashCustomerSessionToken(firstToken, { SENDFLOW_DATABASE_TARGET: "production" });
  const previewHash = hashCustomerSessionToken(firstToken, { SENDFLOW_DATABASE_TARGET: "shared-external" });
  assert.match(productionHash, /^[a-f0-9]{64}$/);
  assert.match(previewHash, /^pv1_[a-f0-9]{60}$/);
  assert.notEqual(productionHash, previewHash);
  assert.notEqual(hashCustomerSessionToken(firstToken), firstToken);
  assert.equal(isCustomerSessionToken(`${firstToken}x`), false);
  assert.equal(isCustomerSessionToken(`${firstToken.slice(0, -1)}!`), false);
});