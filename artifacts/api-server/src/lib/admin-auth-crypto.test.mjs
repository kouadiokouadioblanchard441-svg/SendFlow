import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import {
  ADMIN_ACCESS_TOKEN_TTL_SECONDS,
  createAdminAccessToken,
  createRecoveryCodes,
  createTotpEnrollmentUri,
  decryptTotpSecret,
  encryptTotpSecret,
  hashAdminPassword,
  hashRecoveryCode,
  normalizeAdminEmail,
  verifyAdminAccessToken,
  verifyAdminPassword,
  verifyTotpCode,
} from "./admin-auth-crypto.ts";

const encryptionKey = Buffer.alloc(32, 0x5a).toString("base64url");

test("TOTP matches the RFC SHA-1 vector, allows one adjacent step, and rejects reuse", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(verifyTotpCode(secret, "287082", 59_000), 1);
  assert.equal(verifyTotpCode(secret, "287082", 59_000, 1), null);
  assert.equal(verifyTotpCode(secret, "287082", 89_999), 1);
  assert.equal(verifyTotpCode(secret, "287082", 59_000, 2), null);
  assert.equal(verifyTotpCode(secret, "28x082", 59_000), null);
});

test("encrypted TOTP secrets authenticate ciphertext and require a 256-bit key", () => {
  const environment = { SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY: encryptionKey };
  const encrypted = encryptTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", environment);
  assert.ok(encrypted);
  assert.equal(decryptTotpSecret(encrypted, environment), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(decryptTotpSecret({ ...encrypted, ciphertext: `${encrypted.ciphertext}a` }, environment), null);
  assert.equal(encryptTotpSecret("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", {}), null);
});

test("admin access JWTs enforce RS256, audience, issuer, session and five-minute expiry", () => {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const environment = {
    SENDFLOW_ADMIN_JWT_PRIVATE_KEY: pair.privateKey,
    SENDFLOW_ADMIN_JWT_PUBLIC_KEY: pair.publicKey,
  };
  const sessionId = "7c6e3792-2fc8-4f9f-8dbf-871cfa5c3a12";
  const now = 1_800_000_000;
  const token = createAdminAccessToken(sessionId, now, environment);
  assert.ok(token);
  assert.equal(ADMIN_ACCESS_TOKEN_TTL_SECONDS, 300);
  assert.equal(verifyAdminAccessToken(token, now, environment)?.sid, sessionId);
  assert.equal(verifyAdminAccessToken(token, now + 300, environment), null);

  const [header, payload, signature] = token.split(".");
  const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  assert.equal(verifyAdminAccessToken(`${forgedHeader}.${payload}.${signature}`, now, environment), null);
  assert.equal(verifyAdminAccessToken(`${header}.${payload}.invalid`, now, environment), null);
  assert.equal(createAdminAccessToken("not-a-session", now, environment), null);
});

test("Argon2id password hashes verify only the exact password", async () => {
  const hash = await hashAdminPassword("A long test password that is not a credential");
  assert.match(hash, /^\$argon2id\$/u);
  assert.equal(await verifyAdminPassword("A long test password that is not a credential", hash), true);
  assert.equal(await verifyAdminPassword("different password", hash), false);
  assert.equal(await verifyAdminPassword("x".repeat(2000), hash), false);
});

test("recovery codes are random, canonicalized, and persisted as hashes only", () => {
  const first = createRecoveryCodes();
  const second = createRecoveryCodes();
  assert.equal(first.length, 10);
  assert.notEqual(first[0].code, second[0].code);
  assert.equal(hashRecoveryCode(first[0].code), first[0].hash);
  assert.equal(first[0].code.includes(first[0].hash), false);
  assert.equal(hashRecoveryCode("not-a-recovery-code"), null);
});

test("admin email normalization rejects malformed and control-character input", () => {
  assert.equal(normalizeAdminEmail("  ADMIN@Example.test "), "admin@example.test");
  assert.equal(normalizeAdminEmail("not-an-email"), null);
  assert.equal(normalizeAdminEmail("admin@example.test\n"), null);
  assert.equal(normalizeAdminEmail("a".repeat(255)), null);
});

test("enrollment URI uses the standard authenticator parameters", () => {
  const uri = createTotpEnrollmentUri("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "admin@example.test");
  assert.match(uri, /^otpauth:\/\/totp\//u);
  assert.match(uri, /algorithm=SHA1/u);
  assert.match(uri, /digits=6/u);
  assert.match(uri, /period=30/u);
});
