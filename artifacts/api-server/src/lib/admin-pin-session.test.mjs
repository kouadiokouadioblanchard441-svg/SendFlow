import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminPinSessionToken,
  isAdminPinConfigured,
  verifyAdminPin,
  verifyAdminPinSessionToken,
} from "./admin-pin-session.ts";

const originalPin = process.env.SENDFLOW_ADMIN_PIN;
const originalSessionSecret = process.env.SESSION_SECRET;
process.env.SENDFLOW_ADMIN_PIN = "82160437";
process.env.SESSION_SECRET = "test-only-session-secret-with-at-least-32-bytes";

test("accepts only the configured eight-digit administrator PIN", () => {
  assert.equal(isAdminPinConfigured(), true);
  assert.equal(verifyAdminPin("82160437"), true);
  assert.equal(verifyAdminPin("82160438"), false);
  assert.equal(verifyAdminPin("8216043"), false);
});

test("administrator PIN sessions expire and are bound to the Clerk user and session", () => {
  const now = 1_800_000_000_000;
  const session = createAdminPinSessionToken(
    "user_admin_test",
    "clerk_session_first",
    now,
  );

  assert.ok(session);
  assert.equal(
    verifyAdminPinSessionToken(
      session.token,
      "user_admin_test",
      "clerk_session_first",
      now,
    ),
    true,
  );
  assert.equal(
    verifyAdminPinSessionToken(
      session.token,
      "user_other_test",
      "clerk_session_first",
      now,
    ),
    false,
  );
  assert.equal(
    verifyAdminPinSessionToken(
      session.token,
      "user_admin_test",
      "clerk_session_second",
      now,
    ),
    false,
  );
  assert.equal(
    verifyAdminPinSessionToken(
      session.token,
      "user_admin_test",
      "clerk_session_first",
      session.expiresAt,
    ),
    false,
  );
});

test("changing the administrator PIN invalidates existing sessions", () => {
  const now = 1_800_000_000_000;
  const session = createAdminPinSessionToken(
    "user_admin_test",
    "clerk_session_first",
    now,
  );

  assert.ok(session);
  process.env.SENDFLOW_ADMIN_PIN = "82160438";
  assert.equal(
    verifyAdminPinSessionToken(
      session.token,
      "user_admin_test",
      "clerk_session_first",
      now,
    ),
    false,
  );
  process.env.SENDFLOW_ADMIN_PIN = "82160437";
});

test("rejects malformed session tokens", () => {
  assert.equal(
    verifyAdminPinSessionToken("not-a-session", "user_admin_test", "clerk_session_first"),
    false,
  );
  assert.equal(
    verifyAdminPinSessionToken(undefined, "user_admin_test", "clerk_session_first"),
    false,
  );
});

test.after(() => {
  if (originalPin === undefined) delete process.env.SENDFLOW_ADMIN_PIN;
  else process.env.SENDFLOW_ADMIN_PIN = originalPin;

  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSessionSecret;
});
