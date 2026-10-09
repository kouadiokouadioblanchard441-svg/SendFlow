import assert from "node:assert/strict";
import test from "node:test";
import {
  DIDIT_SESSION_ATTEMPT_LIMIT,
  DIDIT_SESSION_ATTEMPT_WINDOW_MS,
  DIDIT_SESSION_CREATION_LEASE_MS,
  getDiditSessionCreationRetryAfter,
  getDiditSessionRetryAfter,
} from "./didit-session-rate-limit.ts";

const start = new Date("2026-10-09T12:00:00.000Z");

test("new Didit sessions are allowed below the account limit", () => {
  assert.equal(getDiditSessionRetryAfter([], start), null);
  assert.equal(
    getDiditSessionRetryAfter(
      [new Date(start.getTime() - 1000), new Date(start.getTime() - 500)],
      start,
    ),
    null,
  );
});

test("the next session is blocked after three attempts and reports the oldest expiry", () => {
  const attempts = [
    new Date(start.getTime() - DIDIT_SESSION_ATTEMPT_WINDOW_MS + 60_000),
    new Date(start.getTime() - 60_000),
    new Date(start.getTime() - 30_000),
  ];

  assert.equal(DIDIT_SESSION_ATTEMPT_LIMIT, 3);
  assert.equal(getDiditSessionRetryAfter(attempts, start), 60);
});

test("expired Didit attempts do not consume the rolling 24-hour allowance", () => {
  const attempts = [
    new Date(start.getTime() - DIDIT_SESSION_ATTEMPT_WINDOW_MS),
    new Date(start.getTime() - 10_000),
    new Date(start.getTime() - 5_000),
  ];

  assert.equal(getDiditSessionRetryAfter(attempts, start), null);
});

test("an unexpired session reservation blocks duplicate provider requests with a bounded retry", () => {
  assert.equal(
    getDiditSessionCreationRetryAfter(
      [new Date(start.getTime() - DIDIT_SESSION_CREATION_LEASE_MS + 5_000)],
      start,
    ),
    5,
  );
  assert.equal(
    getDiditSessionCreationRetryAfter(
      [new Date(start.getTime() - DIDIT_SESSION_CREATION_LEASE_MS)],
      start,
    ),
    null,
  );
});

test("invalid reservation timestamps do not block new requests", () => {
  assert.equal(getDiditSessionCreationRetryAfter([new Date(Number.NaN)], start), null);
});
