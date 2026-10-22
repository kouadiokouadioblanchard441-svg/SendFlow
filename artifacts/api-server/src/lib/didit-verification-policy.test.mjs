import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_DIDIT_VERIFICATION_STATUSES,
  isReusableDiditVerificationStatus,
  canApplyDiditStatusTransition,
} from "./didit-verification-policy.ts";

test("an approved Didit verification remains reusable", () => {
  assert.equal(isReusableDiditVerificationStatus("Approved"), true);
});

test("KYC expiration revokes approval and stale messages cannot revive it", () => {
  assert.equal(canApplyDiditStatusTransition("Approved", "Kyc Expired"), true);
  assert.equal(canApplyDiditStatusTransition("Kyc Expired", "Approved"), false);
  assert.equal(canApplyDiditStatusTransition("Approved", "In Progress"), false);
  assert.equal(canApplyDiditStatusTransition("In Review", "In Progress"), false);
  assert.equal(canApplyDiditStatusTransition("In Review", "Approved"), true);
  assert.equal(canApplyDiditStatusTransition("unknown", "Approved"), false);
  assert.equal(canApplyDiditStatusTransition("Approved", "unknown"), false);
  const old = new Date("2026-10-01T00:00:00Z");
  const newer = new Date("2026-10-02T00:00:00Z");
  assert.equal(canApplyDiditStatusTransition("Approved", "In Review", newer, old), true);
  assert.equal(canApplyDiditStatusTransition("Approved", "Declined", newer, old), true);
  assert.equal(canApplyDiditStatusTransition("In Review", "Resubmitted", newer, old), true);
  assert.equal(canApplyDiditStatusTransition("In Review", "Approved", old, newer), false);
  assert.equal(canApplyDiditStatusTransition("In Review", "Approved", old, old), false);
  assert.equal(canApplyDiditStatusTransition("Kyc Expired", "Approved", newer, old), true);
  assert.equal(canApplyDiditStatusTransition("Approved", "Declined", old, old), false);
  assert.equal(canApplyDiditStatusTransition("Approved", "In Review", old, old), false);
  assert.equal(canApplyDiditStatusTransition("In Review", "Declined", old, old), false);
  assert.equal(canApplyDiditStatusTransition("In Review", "Approved", new Date("invalid"), old), false);
});

test("unfinished and in-review Didit sessions are reusable", () => {
  for (const status of ACTIVE_DIDIT_VERIFICATION_STATUSES) {
    assert.equal(isReusableDiditVerificationStatus(status), true, status);
  }
  assert.ok(ACTIVE_DIDIT_VERIFICATION_STATUSES.includes("In Review"));
});

test("terminal or unknown Didit statuses do not block a new verification attempt", () => {
  for (const status of ["Declined", "Expired", "Kyc Expired", "Abandoned", "unknown"]) {
    assert.equal(isReusableDiditVerificationStatus(status), false, status);
  }
});
