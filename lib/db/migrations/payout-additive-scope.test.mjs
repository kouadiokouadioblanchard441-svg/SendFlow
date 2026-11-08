import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(
  new URL("./2026-11-08-payout-schema-additive.sql", import.meta.url),
  "utf8",
);

test("payout schema draft is additive and excludes existing payment behavior", () => {
  const allowedAlterTargets = new Set([
    "sf_countries",
    "sf_operator_catalog",
    "sf_payment_limits",
    "sf_payout_requests",
    "sf_payout_attempts",
    "sf_developer_webhook_deliveries",
  ]);
  const alterTargets = [...migration.matchAll(/\bALTER\s+TABLE\s+public\.([a-z_]+)/gi)]
    .map((match) => match[1]);

  assert.match(migration, /(?:^|\n)BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.doesNotMatch(migration, /\bDROP\b|\bCREATE\s+OR\s+REPLACE\b|\bCREATE\s+TRIGGER\b/i);
  assert.doesNotMatch(migration, /\bREVOKE\b|\bGRANT\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration, /\bsf_payments_guard_reservation\b|\bsf_payment_attempts\b|\bsf_payment_intents\b/i);
  assert.doesNotMatch(migration, /\bsf_operation_aggregator_routes\b|\bsf_developer_webhook_endpoints\b/i);
  assert.doesNotMatch(migration, /payment_session_id\s+DROP\s+NOT\s+NULL/i);
  assert.ok(alterTargets.length > 0);
  assert.ok(alterTargets.every((table) => allowedAlterTargets.has(table)));
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS public\.sf_payout_/g) ?? []).length, 4);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS maximum_payout_daily_minor bigint/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_request_id uuid/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payout_state_event_id uuid/);
});
