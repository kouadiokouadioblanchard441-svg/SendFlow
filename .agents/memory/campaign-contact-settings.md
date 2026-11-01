---
name: Campaign contact details
description: Admin-managed support contacts shared by the service page and campaign email footer.
---

Campaign emails must read the current support phone and WhatsApp number from the shared admin-managed customer-service settings at delivery time. Do not hard-code a support number in the template, frontend, or defaults. Campaigns stay disabled for queueing until at least one current support number is configured.

**Why:** The user explicitly requires the active number in the administrator panel to be the source of truth, so contact changes propagate without code edits and no demo number can reach customers.

**How to apply:** When changing campaign templates or support contact presentation, reuse the persisted shared settings and preserve server-side checks; do not add placeholder support numbers as operational values.
