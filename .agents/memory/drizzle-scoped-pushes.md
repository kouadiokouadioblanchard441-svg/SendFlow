---
name: Drizzle pushes against shared Neon
description: How to avoid unrelated schema changes when applying a narrow Drizzle update to Neon.
---

Do not use an intentionally reduced Drizzle schema as a generic way to push one table to shared Neon. The diff may include unrelated enum or table operations, and table filters may not fully isolate the push.

**Why:** Existing production schema objects can differ from the narrow schema snapshot, causing Drizzle to propose or attempt changes outside the requested table.

**How to apply:** Use a reviewed additive migration scoped to the intended objects. If Drizzle reports unrelated changes or prompts, stop and inspect the target schema rather than using `--force` or broad retries.