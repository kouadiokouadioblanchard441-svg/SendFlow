---
name: SendFlow payout business rules
description: User-confirmed funding and fee rules and the security gate for merchant payouts.
---

- Payouts may use the wallet's full balance, but the available amount must exclude any active reservations.
- Administrators configure payout fees by country/operator and operation. The merchant integration chooses whether the merchant or beneficiary pays the SendFlow fee; the server calculates all resulting amounts.
- Do not dispatch or finalize a real payout until provider evidence proves the final result and is correlated to the exact payout. Keep PAYIN settlement controls unchanged.
- Keep XAF unavailable until the provider adapter and SendFlow money model support it.

**Why:** The user explicitly confirmed these financial rules; the current provider contract does not yet establish sufficient final payout proof.

**How to apply:** Use these rules for payout quotes, pricing controls, wallet reservations, and API contracts. Do not remove the execution block or enable XAF based only on a technical route catalog.
