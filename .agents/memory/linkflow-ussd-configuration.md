---
name: LinkFlow USSD configuration
description: Who owns LinkFlow authorization codes and how they are scoped.
---

LinkFlow USSD authorization codes are SendFlow-managed settings. The administrator configures them per country and may set a distinct code for each operator in that country; FeexPay does not supply these codes.

**Why:** The user clarified that code maintenance belongs in the administrator panel rather than with the payment partner.

**How to apply:** Do not seed or assume USSD codes from provider documentation. Keep the country default and country-scoped operator override configurable in the admin panel, and leave unconfigured values blank.
