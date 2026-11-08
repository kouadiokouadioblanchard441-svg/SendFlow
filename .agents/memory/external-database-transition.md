---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target through a server-side secret and CA certificate. The runtime connects with certificate and hostname verification. Some live tables or required singleton rows may still lag behind the Drizzle schema.

The user states that the Supabase connection stored in Replit Secrets is the production database intended for Plesk. The code still separates Replit's `SUPABASE_DATABASE_URL` shared-external target from Plesk's `DATABASE_URL` production target; verify that Plesk points to the same database before claiming production data is live.

With node-postgres, a connection URL containing `sslmode` can override an explicit `ssl.ca` option. Validate the URL first, remove SSL query parameters before creating the pool, and pass the trusted CA with `rejectUnauthorized: true` and `servername` set to the database hostname.

**Why:** A live registration-settings request returned 503 because its table lacked a column required by the current schema and the expected singleton row was absent. A successful database health check or another working table does not prove every runtime query is schema-ready.

**How to apply:** Keep database access server-side and preserve TLS verification. Before fixing a database-backed 5xx, inspect exact columns and required singleton/configuration rows, then apply only an explicitly reviewed additive migration. Never use a broad Drizzle push to repair external production drift. Verify the Plesk target separately; never expose connection strings.

For an authorized external schema change, keep the read-only preflight and DDL on one verified-TLS database session. If a later handshake fails with a certificate-chain error, stop and verify the trusted CA; do not disable certificate checks or assume an earlier connection makes the write safe. The Supabase Root 2021 CA certificate supplied for the OTP instruction migration was accepted with hostname verification enabled.

**Why:** A metadata-only connection succeeded, but a later connection for the approved additive migration failed with `SELF_SIGNED_CERT_IN_CHAIN`.

**How to apply:** Validate the current CA/endpoint configuration before retrying; only execute DDL after the same session confirms the target schema. Use the provider CA bundle for the exact database endpoint; never disable certificate verification.

Re-adding or confirming `DATABASE_CA_CERT` did not by itself resolve the chain error; a subsequent verified connection still failed before opening a transaction. The supplied CA file succeeded when used directly by the one-time migration process, but this did not update the stored Replit secret.

**Why:** The approved OTP-instruction migration remained unapplied after the user confirmed the secret request, and the next attempt returned the same TLS error.

**How to apply:** Do not repeat a migration attempt against the same unresolved secret. If future Replit-side DB access is needed, update `DATABASE_CA_CERT` securely with the verified provider certificate. Plesk needs its own private CA configuration.
