import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailOtpCode,
  hashEmailOtpCode,
  matchesEmailOtpCode,
} from "./email-otp-code.ts";

test("email OTP codes are six digits and cryptographically generated", () => {
  for (let index = 0; index < 50; index += 1) {
    assert.match(createEmailOtpCode(), /^[0-9]{6}$/);
  }
});

test("OTP storage uses a purpose- and challenge-bound HMAC, not the code", () => {
  const previousSessionSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-session-secret-for-email-otp";
  try {
    const hash = hashEmailOtpCode("challenge-1", "signup", "123456");
    assert.notEqual(hash, "123456");
    assert.equal(hash.length, 64);
    assert.equal(matchesEmailOtpCode("challenge-1", "signup", "123456", hash), true);
    assert.equal(matchesEmailOtpCode("challenge-2", "signup", "123456", hash), false);
    assert.equal(matchesEmailOtpCode("challenge-1", "password_reset", "123456", hash), false);
    assert.equal(matchesEmailOtpCode("challenge-1", "signup", "123457", hash), false);
    assert.equal(matchesEmailOtpCode("challenge-1", "signup", "12x456", hash), false);
  } finally {
    if (previousSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSessionSecret;
  }
});
