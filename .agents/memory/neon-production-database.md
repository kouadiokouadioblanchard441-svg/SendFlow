---
name: Production Neon database
description: Safe separation and schema handling for the production Neon PostgreSQL connection.
---

Keep Replit's runtime-managed `DATABASE_URL` untouched. The production API uses a dedicated Neon secret, while development remains on its existing database. Schema pushes to Neon must require an explicit target.

**Why:** Replit reserves `DATABASE_URL`, and a shared/default connection can accidentally send development migrations or startup writes to live financial data. The API's first startup also seeds catalog rates, so that write needs review.

**How to apply:** Before a production database change, verify the connection and inspect schema with read-only queries. Confirm the target is empty or has been backed up, get explicit authorization before DDL, and validate initial pricing before starting the API.