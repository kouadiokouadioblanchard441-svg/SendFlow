---
name: LinkFlow USSD configuration
description: Who owns LinkFlow authorization codes and how they are scoped.
---

LinkFlow USSD authorization codes are SendFlow-managed settings. The administrator configures them per country and may set a distinct code for each operator in that country; FeexPay does not supply these codes.

**Why:** The user clarified that code maintenance belongs in the administrator panel rather than with the payment partner.

**How to apply:** Do not seed or assume USSD codes from provider documentation. Keep the country default and country-scoped operator override configurable in the admin panel, and leave unconfigured values blank.

The user confirms that MTN Côte d’Ivoire uses `*133#` for payment authorization.

**Why:** The user supplied this code to configure for LinkFlow testing.

**How to apply:** Set it only as the Côte d’Ivoire / MTN operator override through an authenticated administrator action; do not change the country default or other operators.
