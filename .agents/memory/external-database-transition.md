---
name: Shared database transition
description: Current external PostgreSQL schema state and the guardrails required before enabling SendFlow operations.
---

The Replit preview uses a shared external PostgreSQL target. Keep the connection URL private; the public provider CA certificate is a trust anchor used with certificate and hostname verification. Some live tables or required singleton rows may still lag behind the Drizzle schema.

The user confirms the Supabase database connection stored in Replit Secrets is the single database for SendFlow work in Replit and Plesk production. Treat it as canonical; if runtime variable names differ, both must resolve to that same Supabase database. Before database-backed work, inspect the project's data model and compare it with the live schema.

**Why:** the user explicitly confirmed that the Replit-secret Supabase database is the only database used for both development work and production.

**How to apply:** Do not assume Plesk uses a separate database. Keep the Plesk runtime pointed at the same Supabase endpoint while preserving verified TLS and the environment-specific variable contract.

The currently configured Replit Supabase runtime login is not a PostgreSQL superuser, but it has `CREATEROLE`, `CREATEDB`, and `BYPASSRLS`, plus SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges on all application tables. Row-level security is enabled on those tables, but this login bypasses it. Plesk's effective database login remains unverified.

**Why:** A read-only catalog audit found the application runtime connection had broad database and table privileges, so enabled RLS alone does not establish least-privilege isolation.

**How to apply:** Until a restricted runtime role is configured and verified, treat the application connection as highly privileged. Keep schema maintenance separate from the runtime login; verify role flags, memberships, and effective table/function grants before claiming RLS protects application queries.

With node-postgres, a connection URL containing `sslmode` can override an explicit `ssl.ca` option. Validate the URL first, remove SSL query parameters before creating the pool, and pass the trusted CA with `rejectUnauthorized: true` and `servername` set to the database hostname.

**Why:** A live registration-settings request returned 503 because its table lacked a column required by the current schema and the expected singleton row was absent. A successful database health check or another working table does not prove every runtime query is schema-ready.

**How to apply:** Keep database access server-side and preserve TLS verification. Before fixing a database-backed 5xx, inspect exact columns and required singleton/configuration rows, then apply only an explicitly reviewed additive migration. Never use a broad Drizzle push to repair external production drift. Confirm Plesk resolves the canonical Supabase connection; never expose connection strings.

A full schema-readiness check must also compare migration-defined indexes, constraints, functions, and triggers. Matching table and column names, or a successful `SELECT 1`, does not prove the financial safeguards were installed.

**Why:** The shared Supabase database contained every modeled table while several raw-SQL financial guard functions and triggers from the migration sources were absent.

**How to apply:** Compare the expected PostgreSQL objects in Drizzle and raw SQL migration files with `pg_catalog` before considering the shared database ready for financial operations.

For an authorized external schema change, keep the read-only preflight and DDL on one verified-TLS database session. If a later handshake fails with a certificate-chain error, stop and verify the trusted CA; do not disable certificate checks or assume an earlier connection makes the write safe. The Supabase Root 2021 CA certificate supplied for the OTP instruction migration was accepted with hostname verification enabled.

**Why:** A metadata-only connection succeeded, but a later connection for the approved additive migration failed with `SELF_SIGNED_CERT_IN_CHAIN`.

**How to apply:** Validate the current CA/endpoint configuration before retrying; only execute DDL after the same session confirms the target schema. Use the provider CA bundle for the exact database endpoint; never disable certificate verification.

If a secret confirmation is followed by the same TLS chain error, it does not prove the running services loaded the intended CA. The verified public provider CA can be stored as a shared environment variable under `DATABASE_CA_CERT`; restart the API and web workflows afterward. Keep private URLs and credentials in Secrets.

**Why:** The live app continued failing closed after the CA was re-confirmed through the secret flow, while a read-only connection using the supplied public CA succeeded. Setting that CA as a shared environment value and restarting restored the health routes and preview without changing database data or schema.

**How to apply:** Validate the provider CA certificate and use the environment-variable flow for this public trust anchor; never print connection URLs, expose credentials, or disable TLS verification. Verify with a read-only query and restart all workflows that import the database client. Plesk needs its own private CA configuration.

If the payment migration registry is absent while raw payment tables or routines already exist, the schema is partial and untracked. Do not replay the base migration or create a blank registry just to bypass the migration runner. Compare the live catalog with the source definitions, preserve intentional payout-aware overrides, add only verified missing objects, and record source checksums plus catalog fingerprints only after postconditions pass.

**Why:** The shared database already held part of the raw payment schema but lacked its migration registry and safeguards; blindly replaying the migration could have overwritten the payout-aware reservation guard.

**How to apply:** Reconcile the partial state in one verified-TLS transaction, verify protected data remains unchanged, then confirm the migration plans against the recorded fingerprints before committing.

Every direct `pg.Client` or `Pool` used by a one-off schema or migration script against shared Supabase must use the same verified-TLS connection-options helper as the application pool, not only the validated URL.

**Why:** PostgreSQL connection-string SSL parameters can override an explicit CA; a read-only schema plan failed certificate validation when its standalone client omitted the CA options.

**How to apply:** Strip SSL query parameters only after confirming `sslmode=verify-full`, then pass the trusted CA, `rejectUnauthorized: true`, and the database hostname as `servername`. Never disable certificate or hostname verification.

The payment schema-version registry rejects updates and deletes. A reviewed payout change can intentionally alter an object covered by the base schema fingerprint; never rewrite an immutable record to hide that drift. An isolated fixture that retains only the base record should expect a fail-closed drift conflict, while a shared final schema should be fingerprinted only after its complete approved catalog is verified.

**Why:** The payout migration deliberately extends a payment guard, so its catalog no longer matches the earlier migration's fingerprint; tests must not bypass the immutable registry to force a green result.

**How to apply:** Keep version records immutable. Verify the final catalog and protected data before registering its fingerprint; test partial migration states for safe refusal rather than silently replaying the base migration.
