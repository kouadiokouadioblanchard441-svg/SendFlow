---
name: Database environment isolation
description: Neon is shared by Plesk production and Replit previews/tests; protect live records.
---

SendFlow uses the same Neon database for Plesk production and Replit previews/tests. The user chose not to copy rows from the former Replit development database. Preview and test processes can therefore see and potentially change live records.

**Why:** The user selected one shared Neon database and schema-only cutover.

**How to apply:** Replit development must opt into the shared Neon target explicitly; Plesk keeps its production target. Inspect Neon metadata before schema changes and use reviewed additive migrations only. Do not run tests that create real accounts, send paid SMS, or change live transfers or balances.