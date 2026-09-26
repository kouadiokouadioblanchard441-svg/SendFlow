---
name: Banner image hosting
description: SendFlow banner image upload and external URL hosting decisions.
---

For SendFlow customer banners, support both external HTTPS URLs and curated image assets bundled under the app's `/banners/` path. Direct panel uploads remain deferred while persistent object storage is unavailable; never simulate them with browser-local files or store image bytes/base64 in PostgreSQL.

**Why:** The user requested hosted URLs and direct uploads, then chose URL-based management first because App Storage was unavailable. Later, they asked for five generated campaign images to be added immediately, so bundling those source-controlled assets provides stable URLs without pretending upload storage exists.

**How to apply:** Keep the `/banners/` path allowlisted to safe image filenames and retain external HTTPS support. Before enabling direct uploads, re-check persistent storage and follow the App Storage signed-upload flow.