import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../routes/identity-verification.ts", import.meta.url),
  "utf8",
);
const schema = readFileSync(
  new URL("../../../../lib/db/src/schema/identity-verification.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../../../../lib/db/migrations/2026-10-09-identity-verification-attempt-state.sql", import.meta.url),
  "utf8",
);

test("Didit reservation is serialized and committed separately from the provider call", () => {
  const reservationStart = route.indexOf("async function reserveDiditSessionAttempt");
  const reservationEnd = route.indexOf("\nfunction statusRank", reservationStart);
  assert.notEqual(reservationStart, -1);
  assert.notEqual(reservationEnd, -1);

  const reservation = route.slice(reservationStart, reservationEnd);
  assert.match(reservation, /\.for\("update"\)/);
  assert.match(reservation, /\.insert\(identityVerificationAttemptsTable\)/);
  assert.match(reservation, /\.delete\(identityVerificationAttemptsTable\)/);
  assert.doesNotMatch(reservation, /createDiditSession/);

  const routeStart = route.indexOf('router.post("/me/identity-verification"');
  const routeEnd = route.indexOf('router.post("/webhooks/didit"');
  const handler = route.slice(routeStart, routeEnd);
  assert.ok(handler.indexOf("await reserveDiditSessionAttempt") < handler.indexOf("await createDiditSession"));
  assert.match(handler, /status: "completed"/);
  assert.match(handler, /markDiditAttemptFailed/);
});

test("attempt state is constrained and provider session IDs are unique", () => {
  assert.match(schema, /statusConstraint:[\s\S]*?sf_identity_verification_attempts_status_check/);
  assert.match(schema, /providerSessionId:[\s\S]*?\.unique\(\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed'/);
  assert.match(migration, /ALTER COLUMN status SET DEFAULT 'creating'/);
  assert.match(migration, /CHECK\s*\(status IN \('creating', 'completed', 'failed', 'abandoned'\)\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS provider_session_id text/);
  assert.match(migration, /UNIQUE \(provider_session_id\)/);
});
