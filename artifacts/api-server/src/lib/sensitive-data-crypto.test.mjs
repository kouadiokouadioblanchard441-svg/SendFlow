import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSensitiveDataLookupIndex,
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

test("sensitive data round-trips with authenticated encryption", () => {
  const plaintext = "+2250701020304";
  const ciphertext = encryptSensitiveData(plaintext, "user-phone");
  assert.notEqual(ciphertext, plaintext);
  assert.equal(decryptSensitiveData(ciphertext, "user-phone"), plaintext);
});

test("encrypting the same value produces different ciphertexts", () => {
  const first = encryptSensitiveData("Awa Traoré", "user-name");
  const second = encryptSensitiveData("Awa Traoré", "user-name");
  assert.notEqual(first, second);
  assert.equal(decryptSensitiveData(first, "user-name"), "Awa Traoré");
  assert.equal(decryptSensitiveData(second, "user-name"), "Awa Traoré");
});

test("ciphertext cannot be decrypted under a different field purpose", () => {
  const ciphertext = encryptSensitiveData("contact label", "contact-label");
  assert.throws(() => decryptSensitiveData(ciphertext, "user-name"));
});

test("tampering with ciphertext or authentication tag fails closed", () => {
  const ciphertext = encryptSensitiveData("reference-123", "provider-reference");
  const parts = ciphertext.split(".");
  parts[3] = `${parts[3]}A`;
  assert.throws(() => decryptSensitiveData(parts.join("."), "provider-reference"));
});

test("lookup indexes are stable and purpose-separated", () => {
  const index = createSensitiveDataLookupIndex("+2250701020304", "user-phone");
  assert.equal(index, createSensitiveDataLookupIndex("+2250701020304", "user-phone"));
  assert.notEqual(index, createSensitiveDataLookupIndex("+2250701020304", "contact-phone"));
});

test("missing or weak keys fail closed", () => {
  const configured = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  delete process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  assert.throws(() => encryptSensitiveData("value", "user-name"));
  process.env.CUSTOMER_PII_ENCRYPTION_KEY = "short";
  assert.throws(() => createSensitiveDataLookupIndex("value", "user-name"));
  process.env.CUSTOMER_PII_ENCRYPTION_KEY = configured;
});
