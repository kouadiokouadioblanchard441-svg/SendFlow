---
name: SendFlow operator logo storage
description: User-required database storage for operator logos uploaded through the admin panel.
---

Store mobile-money operator logos uploaded from the SendFlow admin panel in the database rather than App Storage. Keep this exception limited to operator logos; it does not authorize storing banners or unrelated media in PostgreSQL. Confirm the database target before schema changes when Replit preview and Plesk production share Neon.

**Why:** The user explicitly requires admin-panel uploads to be stored in the database and declined App Storage.

**How to apply:** Use server-side validation and storage, avoid base64 representation, and obtain explicit target confirmation before changing a Neon schema shared with production.
