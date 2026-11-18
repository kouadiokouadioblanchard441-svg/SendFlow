import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_LOGIN_OTP_AFTER_MS,
  requiresCustomerLoginOtp,
} from "./customer-login-otp-policy.ts";

const now = new Date("2026-11-18T12:00:00.000Z");

test("customer login OTP is not required before the 24-hour boundary", () => {
  assert.equal(
    requiresCustomerLoginOtp(new Date(now.getTime() - CUSTOMER_LOGIN_OTP_AFTER_MS + 1), now),
    false,
  );
});

test("customer login OTP is required at exactly 24 hours", () => {
  assert.equal(
    requiresCustomerLoginOtp(new Date(now.getTime() - CUSTOMER_LOGIN_OTP_AFTER_MS), now),
    true,
  );
});

test("customer login OTP is required for accounts without a completed login", () => {
  assert.equal(requiresCustomerLoginOtp(null, now), true);
  assert.equal(requiresCustomerLoginOtp(undefined, now), true);
});

test("invalid or future completed-login timestamps fail closed", () => {
  assert.equal(requiresCustomerLoginOtp(new Date(Number.NaN), now), true);
  assert.equal(
    requiresCustomerLoginOtp(new Date(now.getTime() + 1), now),
    true,
  );
});
