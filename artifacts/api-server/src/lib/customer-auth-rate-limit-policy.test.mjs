import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_ACCESS_RATE_LIMIT_POLICY,
  GENERAL_AUTH_RATE_LIMIT_POLICY,
  formatAuthRateLimitMessage,
  getAuthFailureWindowStart,
  getAuthLockoutExpiry,
} from "./customer-auth-rate-limit-policy.ts";

test("customer access blocks on three failures for a 20-minute window and lockout", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  assert.equal(CUSTOMER_ACCESS_RATE_LIMIT_POLICY.maxFailures, 3);
  assert.equal(CUSTOMER_ACCESS_RATE_LIMIT_POLICY.failureWindowMs, 20 * 60 * 1000);
  assert.equal(CUSTOMER_ACCESS_RATE_LIMIT_POLICY.lockoutDurationMs, 20 * 60 * 1000);
  assert.equal(
    getAuthFailureWindowStart(now, CUSTOMER_ACCESS_RATE_LIMIT_POLICY).toISOString(),
    "2026-10-08T11:40:00.000Z",
  );
  assert.equal(
    getAuthLockoutExpiry(now, CUSTOMER_ACCESS_RATE_LIMIT_POLICY).toISOString(),
    "2026-10-08T12:20:00.000Z",
  );
});

test("the customer lockout message rounds remaining time up to a full minute", () => {
  assert.equal(formatAuthRateLimitMessage(1), "Trop de tentatives. Réessayez dans 1 min.");
  assert.equal(formatAuthRateLimitMessage(60), "Trop de tentatives. Réessayez dans 1 min.");
  assert.equal(formatAuthRateLimitMessage(61), "Trop de tentatives. Réessayez dans 2 min.");
  assert.equal(formatAuthRateLimitMessage(20 * 60), "Trop de tentatives. Réessayez dans 20 min.");
});

test("PIN and administrator auth keep the existing five-failure, 15-minute policy", () => {
  assert.equal(GENERAL_AUTH_RATE_LIMIT_POLICY.maxFailures, 5);
  assert.equal(GENERAL_AUTH_RATE_LIMIT_POLICY.failureWindowMs, 15 * 60 * 1000);
  assert.equal(GENERAL_AUTH_RATE_LIMIT_POLICY.lockoutDurationMs, 15 * 60 * 1000);
});
