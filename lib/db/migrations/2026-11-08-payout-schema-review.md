# Payout schema delta review

## Decision

`2026-11-08-payout-schema-additive.sql` is a rehearsal-only, additive schema
candidate. It creates the four payout tables and adds the currently modeled
payout columns to countries, operators, payment limits, and webhook deliveries.
It does not enable payout execution and has not been approved for a shared
database.

The project owner confirms Supabase is SendFlow's only application database for
both Replit Preview and Plesk. Replit's connection secret contains the Supabase
connection; it is not a Replit-managed database. This workspace cannot inspect
the effective Plesk process environment, so it cannot prove that Plesk actually
loads the same Supabase endpoint, schema, and suitably restricted role. Verify
that server-side configuration before any Plesk migration; do not print
connection values.

**Later schema check (2026-11-09):** a read-only comparison against the
Supabase database configured in Replit found the four payout tables and their
modeled columns present. This does not prove which migration created them or
verify Plesk's runtime configuration.

## Kept out of the additive draft

The legacy `2026-11-08-payout-module.sql` remains a blocked mixed candidate. Do
not execute it. Its non-additive/compatibility changes need a separate review
and rehearsal:

- It replaces the operation check on `sf_operation_aggregator_routes`.
- It replaces webhook endpoint event validation and the existing delivery
  event/entity checks, drops the delivery uniqueness constraint, and makes
  `payment_session_id` nullable. These changes affect PAYIN webhook behavior.
- It replaces `sf_payments_guard_reservation`, a shared payment/PAYIN guard,
  and changes wallet reservation accounting.
- It adds/replaces payout and wallet triggers and revokes privileges.

The additive candidate leaves those objects and existing rows untouched. It
adds the payout webhook foreign-key columns but deliberately does not make
existing delivery rows eligible for payout events.

## Isolated rehearsal and invariants

An isolated rehearsal was completed on a disposable PostgreSQL 16.15 cluster.
The test harness reconstructs the pre-payout shape from the exported Drizzle
schema, applies the existing developer-integration and payment-structure
migrations, then applies the additive candidate twice. Catalog snapshots of
existing PAYIN columns, constraints, indexes, triggers, and `sf_payments_*`
functions were identical before and after, including the original
`payment_session_id` nullability.

`pnpm --filter @workspace/api-server run test:payment-structures` then passed
all 23 isolated payment-structure tests, including PAYIN settlement,
reservation, concurrency, and legacy transaction behavior. The payout policy
suite also confirmed `PAYOUT_EXECUTION_ENABLED` remains `false`. This validates
the draft against the isolated rehearsal schema; it does not prove the live
Plesk schema, target, runtime role, or permissions.

Before approval, compare the exact live object definitions and ACLs with the
Drizzle models and explicitly confirm the migration target. A successful
isolated rehearsal is not approval to migrate a shared or production database.

`CREATE TABLE/COLUMN/INDEX IF NOT EXISTS` is not a schema validator: a
pre-existing object with the wrong definition must fail the preflight, not be
accepted as reconciled. Review actual object definitions and ACLs before any
application to a named target.

Payout execution must remain disabled until an independent, verifiable final
settlement proof is supported end to end and passes the product's amount,
currency, country, operator, beneficiary, account, channel, and execution
reference correlation checks. The current code has
`PAYOUT_EXECUTION_ENABLED = false`; this schema draft does not change it.
