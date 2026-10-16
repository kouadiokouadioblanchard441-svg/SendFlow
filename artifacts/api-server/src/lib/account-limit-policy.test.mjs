import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMonthlyAccountLimit,
  getUtcMonthRange,
  isWithinMonthlyAccountLimit,
  mapDiditStatusToAccountLimitStatus,
} from "./account-limit-policy.ts";

test("only an approved Didit status grants the verified monthly limit", () => {
  assert.equal(getMonthlyAccountLimit(mapDiditStatusToAccountLimitStatus("Approved")), 10_000_000);
  for (const status of [null, "In Progress", "In Review", "Declined", "Expired"]) {
    assert.equal(getMonthlyAccountLimit(mapDiditStatusToAccountLimitStatus(status)), 150_000);
  }
});

test("a quote can reach but never exceed the remaining monthly limit", () => {
  assert.equal(isWithinMonthlyAccountLimit(3_000, 3_000), true);
  assert.equal(isWithinMonthlyAccountLimit(3_001, 3_000), false);
  assert.equal(isWithinMonthlyAccountLimit(1, 0), false);
  assert.equal(isWithinMonthlyAccountLimit(0, 3_000), false);
  assert.equal(isWithinMonthlyAccountLimit(Number.MAX_SAFE_INTEGER + 1, 3_000), false);
});

test("monthly limit periods use UTC calendar boundaries", () => {
  const { periodStart, periodEnd } = getUtcMonthRange(new Date("2026-10-16T12:00:00.000Z"));
  assert.equal(periodStart.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(periodEnd.toISOString(), "2026-11-01T00:00:00.000Z");
});
