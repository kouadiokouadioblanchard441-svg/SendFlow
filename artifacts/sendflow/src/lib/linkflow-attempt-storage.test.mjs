import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLinkFlowCountdown,
  getLinkFlowCountdownSeconds,
  LINKFLOW_PAYMENT_TIMEOUT_SECONDS,
  parseStoredLinkFlowAttempt,
  parseStoredLinkFlowIdempotencyKey,
  shouldShowLinkFlowTimeoutFailure,
} from "./linkflow-attempt-storage.ts";

test("restores only well-formed payment attempts from session storage", () => {
  const valid = {
    attemptId: "11111111-1111-4111-8111-111111111111",
    pollToken: "a".repeat(64),
    expiresAt: null,
  };
  assert.deepEqual(
    parseStoredLinkFlowAttempt(JSON.stringify({ attemptId: valid.attemptId, pollToken: valid.pollToken })),
    valid,
  );
  assert.deepEqual(parseStoredLinkFlowAttempt(JSON.stringify({ ...valid, expiresAt: 123_456 })), {
    ...valid,
    expiresAt: 123_456,
  });
  assert.equal(parseStoredLinkFlowAttempt(null), null);
  assert.equal(parseStoredLinkFlowAttempt("not-json"), null);
  assert.equal(parseStoredLinkFlowAttempt(JSON.stringify({ ...valid, pollToken: "short" })), null);
  assert.equal(parseStoredLinkFlowAttempt(JSON.stringify({ attemptId: 1, pollToken: valid.pollToken })), null);
  assert.equal(
    parseStoredLinkFlowAttempt(JSON.stringify({ ...valid, attemptId: "------------------------------------" })),
    null,
  );
});

test("counts down from ten minutes and formats remaining time safely", () => {
  const deadline = 1_000_000;
  assert.equal(LINKFLOW_PAYMENT_TIMEOUT_SECONDS, 600);
  assert.equal(getLinkFlowCountdownSeconds(deadline, deadline - 600_000), 600);
  assert.equal(getLinkFlowCountdownSeconds(deadline, deadline - 1), 1);
  assert.equal(getLinkFlowCountdownSeconds(deadline, deadline), 0);
  assert.equal(getLinkFlowCountdownSeconds(deadline, deadline + 1), 0);
  assert.equal(formatLinkFlowCountdown(600), "10:00");
  assert.equal(formatLinkFlowCountdown(259), "04:19");
  assert.equal(formatLinkFlowCountdown(-1), "00:00");
});

test("shows timeout failure only when no final server result exists", () => {
  assert.equal(shouldShowLinkFlowTimeoutFailure(0, "waiting"), true);
  assert.equal(shouldShowLinkFlowTimeoutFailure(0, "uncertain"), true);
  assert.equal(shouldShowLinkFlowTimeoutFailure(0, "succeeded"), false);
  assert.equal(shouldShowLinkFlowTimeoutFailure(0, "failed"), false);
  assert.equal(shouldShowLinkFlowTimeoutFailure(1, "waiting"), false);
  assert.equal(shouldShowLinkFlowTimeoutFailure(null, undefined), false);
});

test("restores only UUID-shaped idempotency keys", () => {
  assert.equal(
    parseStoredLinkFlowIdempotencyKey("11111111-1111-4111-8111-111111111111"),
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(parseStoredLinkFlowIdempotencyKey("invalid"), "");
  assert.equal(parseStoredLinkFlowIdempotencyKey("------------------------------------"), "");
  assert.equal(parseStoredLinkFlowIdempotencyKey(null), "");
});
