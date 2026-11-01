import assert from "node:assert/strict";
import test from "node:test";
import {
  canReviewIdentityRequest,
  canStartIdentityVerification,
  getIdentityUploadCleanupCutoffs,
  hasAllIdentityPhotoKinds,
  isIdentityUniqueConstraintViolation,
  meetsIdentityDateRules,
} from "./identity-verification-policy.ts";

test("identity submissions require one of each document image", () => {
  assert.equal(hasAllIdentityPhotoKinds(["front", "back", "selfie"]), true);
  assert.equal(hasAllIdentityPhotoKinds(["front", "front", "selfie"]), false);
  assert.equal(hasAllIdentityPhotoKinds(["front", "back"]), false);
});

test("identity dates require an adult and an unexpired document", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  assert.equal(meetsIdentityDateRules("2008-11-01", "2027-01-01", now), true);
  assert.equal(meetsIdentityDateRules("2008-11-02", "2027-01-01", now), false);
  assert.equal(meetsIdentityDateRules("2000-01-01", "2026-11-01", now), false);
  assert.equal(meetsIdentityDateRules("1899-12-31", "2027-01-01", now), false);
  assert.equal(meetsIdentityDateRules("1900-01-01", "2027-01-01", now), true);
});

test("only pending identity requests can receive an admin decision", () => {
  assert.equal(canReviewIdentityRequest("pending"), true);
  assert.equal(canReviewIdentityRequest("approved"), false);
  assert.equal(canReviewIdentityRequest("rejected"), false);
});

test("approved and pending accounts cannot start another identity request", () => {
  assert.equal(canStartIdentityVerification(undefined), true);
  assert.equal(canStartIdentityVerification("unverified"), true);
  assert.equal(canStartIdentityVerification("rejected"), true);
  assert.equal(canStartIdentityVerification("pending"), false);
  assert.equal(canStartIdentityVerification("approved"), false);
});

test("temporary upload cleanup preserves the current UTC day's quota records", () => {
  const now = new Date("2026-11-02T01:30:00.000Z");
  const cutoffs = getIdentityUploadCleanupCutoffs(now);
  assert.equal(cutoffs.expiredBefore.toISOString(), "2026-11-02T00:30:00.000Z");
  assert.equal(cutoffs.createdBefore.toISOString(), "2026-11-02T00:00:00.000Z");
});

test("database unique conflicts are identified without inspecting arbitrary error text", () => {
  assert.equal(isIdentityUniqueConstraintViolation({ code: "23505" }), true);
  assert.equal(isIdentityUniqueConstraintViolation({ code: "40001" }), false);
  assert.equal(isIdentityUniqueConstraintViolation(new Error("duplicate")), false);
});
