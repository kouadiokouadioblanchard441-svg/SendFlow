---
name: SendFlow payout business rules
description: User-confirmed funding and fee rules and the security gate for merchant payouts.
---

- Payouts may use the wallet's full balance, but the available amount must exclude any active reservations.
- Administrators configure payout fees by country/operator and operation. The merchant integration chooses whether the merchant or beneficiary pays the SendFlow fee; the server calculates all resulting amounts.
- Keep payout execution disabled until SendFlow has a verified final settlement-evidence path correlated to the exact payout. Keep PAYIN settlement controls unchanged.
- A wallet row lock plus cross-table reservation sums is not enough to serialize concurrent payout holds. Keep payouts disabled until payment and payout reservations share an atomic wallet-level invariant.
- Keep XAF unavailable until the SendFlow money model supports it.
- Keep partner identities and routing internals out of payout code and public documentation; build the SendFlow contract around its own wallet, pricing, eligibility and execution abstractions.

**Why:** The user explicitly confirmed these financial rules and requires payout integrations to remain an invisible SendFlow implementation detail.

**How to apply:** Use the authenticated merchant's SendFlow wallet and server-owned available balance for payout quotes, pricing controls, reservations, and API contracts. Do not inspect or expose partner-specific details while implementing SendFlow payout infrastructure. Do not remove the execution block or enable XAF based only on a technical route catalog. Once the complete payout path passes its safety checks, activate it through server-side deployment configuration and database routing, not a source-code switch that must be edited later.

**Why:** A repeated isolated concurrency check admitted simultaneous payout reservations beyond the wallet's available balance.

**How to apply:** Make all active payment and payout holds update one atomic wallet-level reservation invariant, then require the isolated finance concurrency suite to pass before changing any payout gate. Keep activation configuration-driven after that invariant and final-settlement verification are complete.
