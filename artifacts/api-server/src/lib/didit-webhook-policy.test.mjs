import assert from "node:assert/strict";
import test from "node:test";
import {
  isDiditStatusUpdateEvent,
  isExpectedDiditWebhookEnvironment,
} from "./didit-webhook-policy.ts";

test("only Didit's session status event is allowed to change verification status", () => {
  assert.equal(isDiditStatusUpdateEvent("status.updated"), true);
  assert.equal(isDiditStatusUpdateEvent("data.updated"), false);
  assert.equal(isDiditStatusUpdateEvent("business.status.updated"), false);
  assert.equal(isDiditStatusUpdateEvent("user.status.updated"), false);
  assert.equal(isDiditStatusUpdateEvent(undefined), false);
});

test("webhook environment must exactly match a recognized server environment", () => {
  assert.equal(isExpectedDiditWebhookEnvironment("sandbox", "sandbox"), true);
  assert.equal(isExpectedDiditWebhookEnvironment("live", "live"), true);
  assert.equal(isExpectedDiditWebhookEnvironment("live", "sandbox"), false);
  assert.equal(isExpectedDiditWebhookEnvironment("Sandbox", "sandbox"), false);
  assert.equal(isExpectedDiditWebhookEnvironment("sandbox", undefined), false);
  assert.equal(isExpectedDiditWebhookEnvironment(undefined, "sandbox"), false);
});
