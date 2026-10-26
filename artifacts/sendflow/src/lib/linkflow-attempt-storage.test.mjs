import assert from "node:assert/strict";
import test from "node:test";
import {
  parseStoredLinkFlowAttempt,
  parseStoredLinkFlowIdempotencyKey,
} from "./linkflow-attempt-storage.ts";

test("restores only well-formed payment attempts from session storage", () => {
  const valid = {
    attemptId: "11111111-1111-4111-8111-111111111111",
    pollToken: "a".repeat(64),
  };
  assert.deepEqual(parseStoredLinkFlowAttempt(JSON.stringify(valid)), valid);
  assert.equal(parseStoredLinkFlowAttempt(null), null);
  assert.equal(parseStoredLinkFlowAttempt("not-json"), null);
  assert.equal(parseStoredLinkFlowAttempt(JSON.stringify({ ...valid, pollToken: "short" })), null);
  assert.equal(parseStoredLinkFlowAttempt(JSON.stringify({ attemptId: 1, pollToken: valid.pollToken })), null);
  assert.equal(
    parseStoredLinkFlowAttempt(JSON.stringify({ ...valid, attemptId: "------------------------------------" })),
    null,
  );
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
