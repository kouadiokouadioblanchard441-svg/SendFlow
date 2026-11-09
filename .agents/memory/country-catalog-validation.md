---
name: Country numbering and provider coverage
description: Imported country metadata is configuration, not proof of numbering accuracy or SMS/payment support.
---

Do not treat imported telephone-length rules as independently verified national numbering plans.

**Why:** The country catalog preserves earlier customer-side defaults for compatibility; moving them to the server did not establish their accuracy against regulators or live providers.

**How to apply:** Before opening a country, verify its current numbering plan and provider coverage from authoritative sources. Obtain authorization before altering shared production settings or sending paid SMS. Country visibility, signup eligibility and payment readiness are distinct.

For LinkFlow visual review, the authorized Replit viewer may inspect country/operator catalog entries without changing their production enablement. This display-only catalog must never authorize a quote or transaction.

**Why:** The user wants to check flags, phone prefixes and operator logos in the test account before any production rollout.

**How to apply:** Scope preview-only catalog visibility to the link owner’s authorized viewer session on Replit/shared database; keep quote and payment-attempt routes behind the normal country, operator and provider readiness checks.

The user wants country and country-specific operator catalogs managed through the existing admin panel, with no runtime hardcoded country list. Administrators need to add, edit, deactivate, and safely remove unused entries.

**Why:** the user asked for the initial West/Central African country set and future additions to be configurable from the existing panel rather than coded into the application.

**How to apply:** Keep the database-backed admin catalog as the source of truth. New countries and operators must start with payment operations disabled; refuse deletion when existing data or routing depends on an entry.

The signup and account country default is a Supabase registration setting, not a frontend country-code constant or frontend-editable control. The frontend may read it from the API to display the initial selection, but only server/database configuration changes it.

**Why:** the user requested Côte d’Ivoire as the initial choice and explicitly said not to hardcode the country in the application.

**How to apply:** Read the default code from the registration-settings API, preserve a customer’s saved country choice, and fail closed if the configured default is missing or disabled. Keep country-default mutation out of frontend pages and client contracts.
