import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_DIDIT_VERIFICATION_STATUSES,
  isReusableDiditVerificationStatus,
} from "./didit-verification-policy.ts";

test("an approved Didit verification remains reusable", () => {
  assert.equal(isReusableDiditVerificationStatus("Approved"), true);
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
