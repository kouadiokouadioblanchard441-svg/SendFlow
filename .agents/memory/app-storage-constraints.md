---
name: App Storage constraints
description: Environment behavior to check before migrating public landing assets.
---

App Storage provisioning can fail before a bucket is created when the workspace has no remaining credits; in that state no storage environment variables are injected and asset uploads cannot be completed.

**Why:** The migration needs a real public search path and signed object URLs, so writing guessed `storage_path` or `public_url` values would leave Neon pointing at unavailable assets.

**How to apply:** Provision App Storage and confirm `PUBLIC_OBJECT_SEARCH_PATHS` exists before running the landing media migrator; keep local assets until the upload and database transaction succeed.