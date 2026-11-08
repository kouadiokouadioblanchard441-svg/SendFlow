---
name: SendFlow payout business rules
description: User-confirmed funding and fee rules and the security gate for merchant payouts.
---

- Payouts may use the wallet's full balance, but the available amount must exclude any active reservations.
- Administrators configure payout fees by country/operator and operation. The merchant integration chooses whether the merchant or beneficiary pays the SendFlow fee; the server calculates all resulting amounts.
- Keep payout execution disabled until SendFlow has a verified final settlement-evidence path correlated to the exact payout. Keep PAYIN settlement controls unchanged.
- Keep XAF unavailable until the SendFlow money model supports it.
- Keep partner identities and routing internals out of payout code and public documentation; build the SendFlow contract around its own wallet, pricing, eligibility and execution abstractions.

**Why:** The user explicitly confirmed these financial rules and requires payout integrations to remain an invisible SendFlow implementation detail.

**How to apply:** Use the authenticated merchant's SendFlow wallet and server-owned available balance for payout quotes, pricing controls, reservations, and API contracts. Do not inspect or expose partner-specific details while implementing SendFlow payout infrastructure. Do not remove the execution block or enable XAF based only on a technical route catalog.
