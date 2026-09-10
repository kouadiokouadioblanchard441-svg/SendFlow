---
name: App Storage constraints
description: Environment behavior to check before migrating public landing assets.
---

App Storage provisioning can fail before a bucket is created when the workspace has no remaining credits; an existing project may still serve previously migrated public assets while new uploads or provisioning are denied.

**Why:** The migration and admin upload flow need a real public search path and signed object URLs, so writing guessed `storage_path` or `public_url` values would leave Neon pointing at unavailable assets.

**How to apply:** Confirm `PUBLIC_OBJECT_SEARCH_PATHS` and a successful signed PUT before treating an admin upload as complete; keep an explicit URL fallback for existing public assets when the service is suspended.