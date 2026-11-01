---
name: Identity review privacy
description: User requirements for SendFlow's manual identity-submission and administrator-review flow.
---

Identity verification is a manual SendFlow workflow, not a third-party identity-provider flow. Keep submitted identity data encrypted at rest and document images in private storage. Only authorized administrators using the existing admin panel may inspect, download, approve, or reject a dossier. Preserve a per-user request history and audit sensitive reads, downloads, and decisions. Keep scope limited to the identity flow and its existing admin panel; do not redesign unrelated pages.

**Why:** The user explicitly asked for personal information and identity images to appear in the existing administrator panel, remain attached to the user's profile, and support pending, approved, rejected, and download actions.

**How to apply:** For future identity-verification work, preserve server-side authorization, private document delivery, encrypted personal data, and an auditable decision path. Never report the flow as active until its database migration and private-storage configuration are verified.
