---
name: LinkFlow image storage
description: User's storage decision for images attached to LinkFlow payment links.
---

Store LinkFlow user-uploaded images in the database rather than App Storage or another external object store unless the user explicitly changes this decision. The new shared database has no migrated historical image rows.

**Why:** the user chose database storage while understanding that the database would grow.

**How to apply:** preserve database-backed image storage; treat growth, quotas, and retention as decisions to discuss before changing storage or deleting existing images. Verify and migrate existing image rows before relying on them in the new database.
