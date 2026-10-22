---
name: Database environment isolation
description: Use the connected Neon for visualization accounts without broadly opening production access.
---

The user wants the visualization account in the already connected Neon database, not a new separate database. Account credentials must not be hardcoded.

**Why:** The user explicitly changed the earlier separate-database choice and asked to use the connected database.

**How to apply:** Confirm the database target before provisioning. Authorization to create a visualization account is not authorization to unlock preview access to every production account or to run financial operations.

In the shared-Neon preview, allow only known public GET routes and CORS preflights. Block private/customer/admin reads, all writes, malformed paths, and unlisted GET routes before request-body parsing and route handling.

**Why:** The earlier shared-Neon setup connects previews to the same database as Plesk production; a preview must not expose or mutate live records. The user also chose not to copy rows from the former Replit development database.

**How to apply:** Replit development must opt into the shared Neon target explicitly; Plesk keeps its production target. Inspect Neon metadata before schema changes and use reviewed additive migrations only. Do not run tests that create real accounts, send paid SMS, or change live transfers or balances. Keep preview API access fail-closed and test it without customer cookies or mutation endpoints.