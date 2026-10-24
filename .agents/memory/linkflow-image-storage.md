---
name: LinkFlow image storage
description: User's storage decision for images attached to LinkFlow payment links.
---

Store LinkFlow user-uploaded images in Neon rather than App Storage or another external object store unless the user explicitly changes this decision.

**Why:** the user chose database storage while understanding that the database would grow.

**How to apply:** preserve Neon as the storage location; treat growth, quotas, and retention as decisions to discuss before changing storage or deleting existing images.
