---
name: SendFlow transfer business rules
description: User-confirmed funding direction and fee treatment for the three customer transfer flows.
---

The user confirmed these rules as the intended SendFlow behavior:

- Deposit: money moves from the customer's external mobile-money number into the SendFlow wallet.
- Inter-network transfer: money moves between different operators in the same country. Côte d’Ivoire is the original baseline; additional countries must remain closed until explicitly enabled in country and operator settings.
- International transfer: money moves from the SendFlow wallet to a recipient in the selected country. Keep the currently agreed FCFA amount model unless the user changes it.
- If the sender pays fees, debit amount plus fee and deliver the entered amount. Otherwise, debit the entered amount and deliver amount minus fee.
- Monthly account-limit usage counts only successful transfers; pending and failed transfers must not increase the displayed usage.

**Why:** The user explicitly confirmed these rules, including success-only monthly-limit counting, and wants them preserved before operator integrations are added.

**How to apply:** Use these directions consistently in UI labels, fee quotes, validation, and future server-side transaction handling. Never mark an operation successful before an operator or trusted settlement service confirms it. Keep in-flight reservations separate from displayed successful-only usage when enforcing limits atomically.

**Why country expansion is configurable:** The user subsequently requested independent country/operator/operation settings and administrator-managed countries. This does not authorize automatic activation or cross-country inter-network transfers.
