---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target through a server-side secret and CA certificate. The runtime connects with certificate and hostname verification. Some live tables or required singleton rows may still lag behind the Drizzle schema.

The user states that the Supabase connection stored in Replit Secrets is the production database intended for Plesk. The code still separates Replit's `SUPABASE_DATABASE_URL` shared-external target from Plesk's `DATABASE_URL` production target; verify that Plesk points to the same database before claiming production data is live.

With node-postgres, a connection URL containing `sslmode` can override an explicit `ssl.ca` option. Validate the URL first, remove SSL query parameters before creating the pool, and pass the trusted CA with `rejectUnauthorized: true` and `servername` set to the database hostname.

**Why:** A live registration-settings request returned 503 because its table lacked a column required by the current schema and the expected singleton row was absent. A successful database health check or another working table does not prove every runtime query is schema-ready.

**How to apply:** Keep database access server-side and preserve TLS verification. Before fixing a database-backed 5xx, inspect exact columns and required singleton/configuration rows, then apply only an explicitly reviewed additive migration. Never use a broad Drizzle push to repair external production drift. Verify the Plesk target separately; never expose connection strings.
