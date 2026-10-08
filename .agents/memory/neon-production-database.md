---
name: Database environment isolation
description: Keep Replit development/testing data separate from Plesk production data.
---

Replit uses a separate database for development and tests. Plesk production has its own database, secrets, data, and migration process. Do not use the production database for preview or route-level tests.

**Why:** The user selected separate databases for Replit and Plesk.

**How to apply:** Verify the database target explicitly before schema changes, migrations, or integration tests. Keep Replit development/test and Plesk production credentials and data isolated.