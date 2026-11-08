---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target. Keep the connection URL private; the public provider CA certificate is a trust anchor used with certificate and hostname verification. Some live tables or required singleton rows may still lag behind the Drizzle schema.

The user confirms Supabase is the database to use throughout SendFlow development. Before database-backed work, inspect the project's data model and compare it with the live schema. The code still separates Replit's `SUPABASE_DATABASE_URL` shared-external target from Plesk's `DATABASE_URL` production target; verify that Plesk points to the same database before claiming production data is live.

With node-postgres, a connection URL containing `sslmode` can override an explicit `ssl.ca` option. Validate the URL first, remove SSL query parameters before creating the pool, and pass the trusted CA with `rejectUnauthorized: true` and `servername` set to the database hostname.

**Why:** A live registration-settings request returned 503 because its table lacked a column required by the current schema and the expected singleton row was absent. A successful database health check or another working table does not prove every runtime query is schema-ready.

**How to apply:** Keep database access server-side and preserve TLS verification. Before fixing a database-backed 5xx, inspect exact columns and required singleton/configuration rows, then apply only an explicitly reviewed additive migration. Never use a broad Drizzle push to repair external production drift. Verify the Plesk target separately; never expose connection strings.

For an authorized external schema change, keep the read-only preflight and DDL on one verified-TLS database session. If a later handshake fails with a certificate-chain error, stop and verify the trusted CA; do not disable certificate checks or assume an earlier connection makes the write safe. The Supabase Root 2021 CA certificate supplied for the OTP instruction migration was accepted with hostname verification enabled.

**Why:** A metadata-only connection succeeded, but a later connection for the approved additive migration failed with `SELF_SIGNED_CERT_IN_CHAIN`.

**How to apply:** Validate the current CA/endpoint configuration before retrying; only execute DDL after the same session confirms the target schema. Use the provider CA bundle for the exact database endpoint; never disable certificate verification.

If a secret confirmation is followed by the same TLS chain error, it does not prove the running services loaded the intended CA. The verified public provider CA can be stored as a shared environment variable under `DATABASE_CA_CERT`; restart the API and web workflows afterward. Keep private URLs and credentials in Secrets.

**Why:** The live app continued failing closed after the CA was re-confirmed through the secret flow, while a read-only connection using the supplied public CA succeeded. Setting that CA as a shared environment value and restarting restored the health routes and preview without changing database data or schema.

**How to apply:** Validate the provider CA certificate and use the environment-variable flow for this public trust anchor; never print connection URLs, expose credentials, or disable TLS verification. Verify with a read-only query and restart all workflows that import the database client. Plesk needs its own private CA configuration.
