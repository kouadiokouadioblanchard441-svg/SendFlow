---
name: Drizzle production schema pushes
description: Keep production PostgreSQL schema updates additive and isolated from Replit development.
---

Do not use an intentionally reduced Drizzle schema as a generic way to push one table to Plesk production. The diff may include unrelated enum or table operations, and table filters may not fully isolate the push.

**Why:** Existing production schema objects can differ from the development schema snapshot, causing Drizzle to propose or attempt changes outside the requested table.

**How to apply:** Keep Replit development pushes separate from Plesk production migrations. Use reviewed additive migrations scoped to the intended production objects. If Drizzle reports unrelated changes or prompts, stop and inspect the target schema rather than using `--force` or broad retries.