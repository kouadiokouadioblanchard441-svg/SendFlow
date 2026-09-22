---
name: SendFlow admin panel guardrails
description: Security and data-integrity decisions for the SendFlow back office.
---

The SendFlow back office is read-only until server-side administrator authorization, real database-backed metrics, and audit requirements are in place. Never use a client-only route check or demo financial values.

**Why:** SendFlow handles financial data, and the existing customer PIN/session flag is not an authorization boundary. The admin schema currently exposes users, wallets, deposits, and transfers, but not every example-panel concept such as withdrawals.

**How to apply:** Keep admin API routes deny-by-default and enforce authorization on the server. Add new metrics only when their source exists in the database and label unsupported operations explicitly instead of inventing them.