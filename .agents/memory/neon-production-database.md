---
name: Production Neon database
description: Safe separation and schema handling for the production Neon PostgreSQL connection.
---

All SendFlow runtime environments intentionally use the shared Neon connection. Treat development previews and tests as live production access; do not add synthetic or disposable financial records.

**Why:** The user chose Neon as the single database and authorized retiring Replit's separate development database. Replit database removal is managed through the Database pane, not by changing `DATABASE_URL` manually.

**How to apply:** Keep runtime code on the Neon secret in every environment. Require `DRIZZLE_DATABASE_TARGET=neon-production` for schema changes, and verify previews against production with read-only checks unless the user explicitly authorizes a write.