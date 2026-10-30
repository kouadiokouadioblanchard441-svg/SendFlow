---
name: Database provider transition
description: Supabase is the intended replacement for Neon; retain safeguards until the application is explicitly migrated.
---

The user's current target choice is Supabase instead of Neon. The application runtime has not yet been switched; current Neon-specific configuration and safeguards remain relevant until cutover.

**Why:** The user stated that SendFlow will stop using Neon and use Supabase.

**How to apply:** Treat Supabase as the intended target, not as an already active runtime. Confirm the connection and inspect the target read-only; establish whether existing data must be migrated; update runtime configuration and apply reviewed schema changes only after these checks. Do not remove the old database or source data before a verified cutover.

In the shared-Neon preview, keep public reads and preflights available. Customer preview access is restricted to the single database-authorized viewing account. Other customers, administrator routes, financial changes and real provider calls remain blocked. Permit only the viewing account's necessary authentication/PIN writes and quote counters.

**Why:** The earlier shared-Neon setup connects previews to the same database as Plesk production; a preview must not expose or mutate live records. The user also chose not to copy rows from the former Replit development database.

**How to apply:** Replit development must opt into the shared Neon target explicitly; Plesk keeps its production target. Inspect Neon metadata before schema changes and use reviewed additive migrations only. Do not run tests that create real accounts, send paid SMS, or change live transfers or balances. Keep preview API access fail-closed. Authenticated and mutation tests must use a disposable database.

Previous authorization for live tests against Neon does not authorize real payments against Supabase or any new database target.

**Why:** A database-provider change is not authorization to initiate financial operations.

**How to apply:** Keep payment execution disabled during database setup. Use isolated tests and require explicit authorization for any real financial operation.

Viewing credentials and sessions must remain unusable by the production API, including older Plesk code.

**Why:** Replit and Plesk share a database but can run different application versions. A permission check added only to Replit would not constrain an older production recovery endpoint.

**How to apply:** Preserve both application and database enforcement of the viewing realm. Never convert a viewer into a normal financial customer through recovery or grant expiration.

Do not infer Plesk's runtime PostgreSQL role from the shared secret available in Replit.

**Why:** The shared connection can authenticate as the database owner without providing any evidence of which credentials the external Plesk process actually uses.

**How to apply:** Report the observed connection role separately. Confirm the effective/login roles through the actual Plesk runtime connection before judging its permissions or proposing grants.

For read-only Neon catalog checks, begin a transaction with `BEGIN READ ONLY` after connecting instead of sending a PostgreSQL startup `options` parameter through the Neon pooler.

**Why:** The pooler rejected the startup option with SQLSTATE `08P01`; a transaction-level read-only mode worked without weakening the inspection.

**How to apply:** Query only catalog metadata, set a short statement timeout, and roll back the read-only transaction when finished.