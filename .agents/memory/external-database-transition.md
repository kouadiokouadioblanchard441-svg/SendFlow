---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target through a server-side secret and CA certificate. Its baseline schema has 46 tables, five enum types, and 132 indexes. The runtime connects with certificate and hostname verification, and the read-only health endpoint succeeds. Payment-limit reads still lack the required `global` row; custom financial triggers, runtime roles, and the production `DATABASE_URL` remain unverified.

The user states that the Supabase connection stored in Replit Secrets is the production database intended for Plesk. The code still separates Replit's `SUPABASE_DATABASE_URL` shared-external target from Plesk's `DATABASE_URL` production target; verify that Plesk points to the same database before claiming production data is live.

With node-postgres, a connection URL containing `sslmode` can override an explicit `ssl.ca` option. Validate the URL first, remove SSL query parameters before creating the pool, and pass the trusted CA with `rejectUnauthorized: true` and `servername` set to the database hostname.

**Why:** The user directed SendFlow to move from its prior database to Supabase and requested table creation, while preserving financial data and keeping connection values out of source and client code. The PostgreSQL TLS chain also requires the Supabase root CA in this runtime.

**How to apply:** Keep all database access on the server. Preserve TLS certificate and hostname verification. Do not enable production payments or switch Plesk until data preservation, required triggers and seed configuration, database permissions, production TLS, and health checks are verified. Never copy or expose connection strings. Use an isolated database for integration tests; no data migration or payment is authorized by table creation alone.

**Why:** The user explicitly identified the Replit-stored Supabase connection as the database they intend to use in Plesk, but the environment mapping has not yet been independently verified.

**How to apply:** Treat that as the user's intended target, not proof that the active Plesk process currently uses it. Keep Replit's shared-external write guard intact; Plesk production writes must use its explicitly configured production `DATABASE_URL`.
