import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adminActionKey,
  hashAdminActionPayload,
  issueableAdminAction,
} from "./admin-step-up-policy.ts";

test("action-bound step-up keys require a concrete admin mutation route", () => {
  assert.equal(adminActionKey("PATCH", "/operator-pricing"), "PATCH:/operator-pricing");
  assert.equal(adminActionKey("GET", "/operator-pricing"), null);
  assert.equal(adminActionKey("POST", "/sign-in"), null);
  assert.equal(adminActionKey("POST", "/path/../escape"), null);
  assert.equal(adminActionKey("DELETE", "/identity-verifications/abc"), "DELETE:/identity-verifications/abc");
});

test("step-up payload hashes are canonical and sensitive to changed parameters", () => {
  const first = hashAdminActionPayload({}, { amount: 2000, currency: "XOF" });
  const reordered = hashAdminActionPayload({}, { currency: "XOF", amount: 2000 });
  const changed = hashAdminActionPayload({}, { amount: 2001, currency: "XOF" });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("step-up action input rejects malformed methods and paths", () => {
  assert.deepEqual(
    issueableAdminAction("PATCH:/payment-limits", {}, { monthlyLimit: 20000 }),
    {
      actionKey: "PATCH:/payment-limits",
      payloadHash: hashAdminActionPayload({}, { monthlyLimit: 20000 }),
    },
  );
  assert.equal(issueableAdminAction("POST:/step-up", {}, {}), null);
  assert.equal(issueableAdminAction("PATCH:https://outside.test", {}, {}), null);
  assert.equal(issueableAdminAction("PATCH:/x?return=/", {}, {}), null);
});
