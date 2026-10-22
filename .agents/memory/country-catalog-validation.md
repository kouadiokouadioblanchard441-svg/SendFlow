---
name: Country numbering and provider coverage
description: Imported country metadata is configuration, not proof of numbering accuracy or SMS/payment support.
---

Do not treat imported telephone-length rules as independently verified national numbering plans.

**Why:** The country catalog preserves earlier customer-side defaults for compatibility; moving them to the server did not establish their accuracy against regulators or live providers.

**How to apply:** Before opening a country, verify its current numbering plan and provider coverage from authoritative sources. Obtain authorization before altering shared production settings or sending paid SMS. Country visibility, signup eligibility and payment readiness are distinct.
