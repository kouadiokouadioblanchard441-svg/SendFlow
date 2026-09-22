---
name: SendFlow admin panel guardrails
description: Security and data-integrity decisions for the SendFlow back office.
---

The SendFlow back office is read-only until server-side administrator authorization, real database-backed metrics, and audit requirements are in place. Never use a client-only route check or demo financial values.

**Why:** SendFlow handles financial data, and the existing customer PIN/session flag is not an authorization boundary. The admin schema currently exposes users, wallets, deposits, and transfers, but not every example-panel concept such as withdrawals.

**How to apply:** Keep admin API routes deny-by-default and enforce authorization on the server. Add new metrics only when their source exists in the database and label unsupported operations explicitly instead of inventing them.

The user detail view remains read-only: profile and wallet data come from the server, while the transaction history is retrieved through a server-side user filter with bounded pagination rather than an unbounded detail payload.

**Why:** Financial histories can grow without limit, and a client-only filter would risk exposing another user’s operations if the server did not constrain the query.

**How to apply:** Keep the user identifier in the authorization-protected API contract and apply it in the database query. Do not add admin mutations until the audit, permission, ledger, and approval model exists.

Successful sensitive detail reads are fail-closed on audit persistence: if the server cannot append the administrator/resource access record, it must not return the user or transaction detail.

**Why:** A financial-data access that is visible to an administrator but absent from the audit trail cannot be reliably investigated later.

**How to apply:** Append only the administrator identity, action, resource type, resource identifier, and timestamp; avoid IPs, query strings, idempotency secrets, and financial payloads in the audit record.