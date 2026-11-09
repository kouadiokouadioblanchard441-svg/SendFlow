---
name: Monthly wallet payment limits
description: Monthly incoming and outgoing caps, identity tiers, and administrator overrides.
---

Use the same effective monthly cap for incoming and outgoing XOF activity, but keep independent counters. Defaults are 20,000 FCFA while identity is not approved and 4,000,000 FCFA after approval. Receipts earlier in the same month still count if identity is approved mid-month. Administrators can edit both global caps and set a per-user override; the override replaces the global tier cap until cleared. Receiving 20,000 FCFA does not consume the separate 20,000 FCFA outgoing allowance.

Reject a new incoming payment or outgoing request before provider dispatch when its own direction's total would exceed that direction's remaining cap; a request that lands exactly on the cap is allowed. Count confirmed activity and reserve capacity for active, unsettled attempts in the matching direction. Do not cancel an attempt already started: keep its capacity reserved until it reaches a verified final result. Outgoing activity remains subject to balance, risk, and provider checks in addition to its separate cap.

**Why:** the user replaced the old 150,000 FCFA outgoing cap with the same identity-tier monthly amount used for incoming payments, while explicitly requiring separate counters so a user can receive and withdraw the full 20,000 FCFA within the month.

**How to apply:** resolve the user override first, otherwise select the global cap from approved identity status. Sum monthly incoming credits and outgoing transfers/payouts independently, adding active reservations to each corresponding total. Enforce both counters on the server before calling a provider; never subtract incoming totals from outgoing allowance or vice versa. Preserve existing balance, risk, provider, and verified-settlement safeguards.
