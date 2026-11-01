import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSensitiveDataLookupIndex,
  decryptSensitiveData,
  encryptSensitiveData,
  normalizeSensitiveEmailForLookup,
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

test("customer email is encrypted at rest with an email-specific purpose", () => {
  const email = "customer@example.invalid";
  const ciphertext = encryptSensitiveData(email, "user-email");
  assert.notEqual(ciphertext, email);
  assert.equal(ciphertext.includes(email), false);
  assert.equal(decryptSensitiveData(ciphertext, "user-email"), email);
  assert.throws(() => decryptSensitiveData(ciphertext, "user-name"));
});

test("customer email lookup normalization is case and Unicode stable", () => {
  assert.equal(
    normalizeSensitiveEmailForLookup("  Customer@Example.com  "),
    "customer@example.com",
  );
  assert.equal(
    normalizeSensitiveEmailForLookup("ＣＵＳＴＯＭＥＲ@example.com"),
    "customer@example.com",
  );
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

test("context-bound envelopes authenticate context and preserve key-version rotation", () => {
  const originalId = process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID;
  const originalKeyring = process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
  const oldKey = process.env.CUSTOMER_PII_ENCRYPTION_KEY;
  try {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = "key-old";
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "old-test-key-material-longer-than-32-bytes";
    delete process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
    const ciphertext = encryptSensitiveData("bound-payload", "developer-webhook-payload", {
      authenticatedContext: '["delivery","payment.succeeded"]',
    });
    assert.match(ciphertext, /^sfenc-v2\.key-old\./);

    process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = "key-new";
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = "new-test-key-material-longer-than-32-bytes";
    assert.throws(() => decryptSensitiveData(ciphertext, "developer-webhook-payload", {
      authenticatedContext: '["delivery","payment.succeeded"]',
    }));
    process.env.CUSTOMER_PII_ENCRYPTION_KEYRING = JSON.stringify({
      "key-old": "old-test-key-material-longer-than-32-bytes",
    });
    assert.equal(
      decryptSensitiveData(ciphertext, "developer-webhook-payload", {
        authenticatedContext: '["delivery","payment.succeeded"]',
      }),
      "bound-payload",
    );
    assert.throws(() => decryptSensitiveData(
      ciphertext.replace("sfenc-v2", "sfenc-v3"),
      "developer-webhook-payload",
      { authenticatedContext: '["delivery","payment.succeeded"]' },
    ));
  } finally {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY = oldKey;
    if (originalId === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID;
    else process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = originalId;
    if (originalKeyring === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
    else process.env.CUSTOMER_PII_ENCRYPTION_KEYRING = originalKeyring;
  }
});

test("unknown historical key versions fail without exposing key material", () => {
  const originalId = process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID;
  const originalKeyring = process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
  try {
    process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = "key-current";
    process.env.CUSTOMER_PII_ENCRYPTION_KEYRING = "{}";
    assert.throws(
      () => decryptSensitiveData(
        "sfenc-v2.key-retired.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AA",
        "developer-webhook-payload",
        { authenticatedContext: "context" },
      ),
      (error) => error.message === "Sensitive-data encryption key version is unavailable",
    );
  } finally {
    if (originalId === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID;
    else process.env.CUSTOMER_PII_ENCRYPTION_KEY_ID = originalId;
    if (originalKeyring === undefined) delete process.env.CUSTOMER_PII_ENCRYPTION_KEYRING;
    else process.env.CUSTOMER_PII_ENCRYPTION_KEYRING = originalKeyring;
  }
});
