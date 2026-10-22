---
name: Database environment isolation
description: Use the connected Neon for visualization accounts without broadly opening production access.
---

The user wants the visualization account in the already connected Neon database, not a new separate database. Account credentials must not be hardcoded.

**Why:** The user explicitly changed the earlier separate-database choice and asked to use the connected database.

**How to apply:** Confirm the database target before provisioning. The user authorized preview access strictly for this account, not for every production account or for financial operations.

In the shared-Neon preview, keep public reads and preflights available. Customer preview access is restricted to the single database-authorized viewing account. Other customers, administrator routes, financial changes and real provider calls remain blocked. Permit only the viewing account's necessary authentication/PIN writes and quote counters.

**Why:** The earlier shared-Neon setup connects previews to the same database as Plesk production; a preview must not expose or mutate live records. The user also chose not to copy rows from the former Replit development database.

**How to apply:** Replit development must opt into the shared Neon target explicitly; Plesk keeps its production target. Inspect Neon metadata before schema changes and use reviewed additive migrations only. Do not run tests that create real accounts, send paid SMS, or change live transfers or balances. Keep preview API access fail-closed. Authenticated and mutation tests must use a disposable database.

Viewing credentials and sessions must remain unusable by the production API, including older Plesk code.

**Why:** Replit and Plesk share a database but can run different application versions. A permission check added only to Replit would not constrain an older production recovery endpoint.

**How to apply:** Preserve both application and database enforcement of the viewing realm. Never convert a viewer into a normal financial customer through recovery or grant expiration.