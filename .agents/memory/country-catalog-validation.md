---
name: Country numbering and provider coverage
description: Imported country metadata is configuration, not proof of numbering accuracy or SMS/payment support.
---

Do not treat imported telephone-length rules as independently verified national numbering plans.

**Why:** The country catalog preserves earlier customer-side defaults for compatibility; moving them to the server did not establish their accuracy against regulators or live providers.

**How to apply:** Before opening a country, verify its current numbering plan and provider coverage from authoritative sources. Obtain authorization before altering shared production settings or sending paid SMS. Country visibility, signup eligibility and payment readiness are distinct.

For LinkFlow visual review, the authorized Replit viewer may inspect country/operator catalog entries without changing their production enablement. This display-only catalog must never authorize a quote or transaction.

**Why:** The user wants to check flags, phone prefixes and operator logos in the test account before any production rollout.

**How to apply:** Scope preview-only catalog visibility to the link owner’s authorized viewer session on Replit/shared Neon; keep quote and payment-attempt routes behind the normal country, operator and provider readiness checks.
