import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRemainingMonthlyAccountLimit,
  getUtcMonthRange,
  isWithinMonthlyAccountLimit,
} from "./account-limit-policy.ts";

test("outgoing usage can reach but never exceed its separate monthly tier cap", () => {
  assert.equal(isWithinMonthlyAccountLimit(20_000, 20_000), true);
  assert.equal(isWithinMonthlyAccountLimit(20_001, 20_000), false);
  assert.equal(isWithinMonthlyAccountLimit(4_000_000, 4_000_000), true);
  assert.equal(isWithinMonthlyAccountLimit(1, 0), false);
  assert.equal(isWithinMonthlyAccountLimit(0, 3_000), false);
  assert.equal(isWithinMonthlyAccountLimit(Number.MAX_SAFE_INTEGER + 1, 3_000), false);
});

test("pending outgoing requests reserve the monthly allowance before settlement", () => {
  assert.equal(getRemainingMonthlyAccountLimit(20_000, 15_000, 2_000), 3_000);
  assert.equal(getRemainingMonthlyAccountLimit(20_000, 20_000, 0), 0);
  assert.equal(getRemainingMonthlyAccountLimit(20_000, 10_000, 10_000), 0);
  assert.throws(() => getRemainingMonthlyAccountLimit(-1, 0, 0));
});

test("monthly limit periods use UTC calendar boundaries", () => {
  const { periodStart, periodEnd } = getUtcMonthRange(new Date("2026-10-16T12:00:00.000Z"));
  assert.equal(periodStart.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(periodEnd.toISOString(), "2026-11-01T00:00:00.000Z");
});
