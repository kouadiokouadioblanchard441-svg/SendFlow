import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_SESSION_TTL_MS,
  customerSessionCookieOptions,
  customerSessionExpiresAt,
  isCustomerSessionPastMaximumAge,
} from "./customer-session-policy.ts";

test("customer authentication session expires after exactly ten minutes", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(CUSTOMER_SESSION_TTL_MS, 10 * 60 * 1000);
  assert.equal(customerSessionExpiresAt(now).getTime(), now.getTime() + 10 * 60 * 1000);
});

test("customer session cookie shares the ten-minute TTL and secure flags", () => {
  const options = customerSessionCookieOptions();
  assert.equal(options.maxAge, 10 * 60 * 1000);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "none");
  assert.equal(options.path, "/");
});

test("customer sessions issued before the change are rejected at ten minutes", () => {
  const createdAt = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(
    isCustomerSessionPastMaximumAge(createdAt, new Date("2026-11-18T12:09:59.999Z")),
    false,
  );
  assert.equal(
    isCustomerSessionPastMaximumAge(createdAt, new Date("2026-11-18T12:10:00.000Z")),
    true,
  );
  assert.equal(
    isCustomerSessionPastMaximumAge(createdAt, new Date("2026-11-18T12:30:00.000Z")),
    true,
  );
});

test("invalid or future customer session timestamps fail closed", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  assert.equal(isCustomerSessionPastMaximumAge(new Date("invalid"), now), true);
  assert.equal(
    isCustomerSessionPastMaximumAge(new Date("2026-11-18T12:00:00.001Z"), now),
    true,
  );
});
