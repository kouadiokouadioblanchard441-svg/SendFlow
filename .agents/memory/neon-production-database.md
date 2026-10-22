---
name: Database environment isolation
description: Keep visualization accounts in isolated Neon and protect any shared-production connection.
---

The user chose a separate Neon database for visualization accounts. Do not create those accounts in the production database or copy real customer rows into the visualization database. Account credentials must not be hardcoded.

**Why:** The user explicitly selected a separate Neon visualization database to sign in and inspect the app without putting an account in source code.

**How to apply:** Verify database isolation before enabling customer login in the preview. Keep production connection settings and data untouched.

In the shared-Neon preview, allow only known public GET routes and CORS preflights. Block private/customer/admin reads, all writes, malformed paths, and unlisted GET routes before request-body parsing and route handling.

**Why:** The earlier shared-Neon setup connects previews to the same database as Plesk production; a preview must not expose or mutate live records. The user also chose not to copy rows from the former Replit development database.

**How to apply:** Replit development must opt into the shared Neon target explicitly; Plesk keeps its production target. Inspect Neon metadata before schema changes and use reviewed additive migrations only. Do not run tests that create real accounts, send paid SMS, or change live transfers or balances. Keep preview API access fail-closed and test it without customer cookies or mutation endpoints.