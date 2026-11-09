---
name: Idempotent migration inserts
description: PostgreSQL can reject NOT NULL values before resolving an INSERT conflict.
---

When an additive repair needs to preserve an existing singleton, guard insertion with `INSERT ... SELECT ... WHERE NOT EXISTS` instead of assuming `ON CONFLICT DO NOTHING` skips all row validation. PostgreSQL can enforce NOT NULL on the attempted row before it resolves a unique conflict.

**Why:** The isolated registration repair test showed that a conflicting row did not prevent a missing required country value from failing the statement.

**How to apply:** Check the target table's full set of required columns when writing idempotent inserts, then exercise the SQL against the actual prepared schema.
