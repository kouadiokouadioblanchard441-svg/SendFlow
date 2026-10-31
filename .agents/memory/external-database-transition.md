---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target through a server-side secret. The baseline schema was created with 46 tables and no customer, wallet, payment, country, operator, or admin data was transferred or seeded. The API workflow has not yet been verified against this target. Payment-limit reads require a `global` row, and custom financial triggers, catalog seeds, runtime roles, and the production `DATABASE_URL` still need verification.

**Why:** The user directed SendFlow to move from its prior database to Supabase and requested table creation, while preserving financial data and keeping connection values out of source and client code.

**How to apply:** Keep all database access on the server. Do not enable production payments or switch Plesk until data preservation, required triggers and seed configuration, database permissions, TLS, and health checks are verified. Never copy or expose connection strings. Use an isolated database for integration tests; no data migration or payment is authorized by table creation alone.
