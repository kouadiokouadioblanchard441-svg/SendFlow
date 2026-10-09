import assert from "node:assert/strict";
import test from "node:test";
import { createCustomerPinRotationSessionPolicy } from "./customer-pin-session-policy.ts";

test("PIN rotation relocks every active customer session and unlocks only the current session", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");
  const policy = createCustomerPinRotationSessionPolicy(
    "customer-42",
    "session-current",
    now,
    15 * 60 * 1000,
  );

  assert.equal(policy.relockActiveSessionsForUserId, "customer-42");
  assert.equal(policy.currentSessionId, "session-current");
  assert.equal(policy.unlockCurrentSessionUntil.toISOString(), "2026-10-09T12:15:00.000Z");
});
