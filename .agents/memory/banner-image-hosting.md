---
name: Banner image hosting
description: SendFlow banner image upload and external URL hosting decisions.
---

For SendFlow customer banners, external HTTPS image URLs are the supported path while persistent object storage is unavailable. Direct file uploads are intentionally deferred; never simulate them with browser-local files or store image bytes/base64 in PostgreSQL.

**Why:** The user requested both panel uploads and hosted URLs, then chose hosted URLs first because App Storage could not be provisioned in the workspace at implementation time.

**How to apply:** Before enabling direct uploads, re-check that persistent object storage is configured and follow the App Storage signed-upload flow. Keep URL support available alongside uploads.