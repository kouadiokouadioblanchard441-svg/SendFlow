---
name: Monthly wallet receipt limits
description: Monthly incoming-payment caps, identity tiers, and administrator overrides.
---

Use the sum of confirmed provider-originated XOF credits actually posted to the wallet from the start of the current UTC month. Also reserve capacity for active, unsettled provider deposits so concurrent attempts cannot exceed the cap. The global cap is 20,000 FCFA while identity is not approved and 4,000,000 FCFA after approval. Receipts earlier in the same month still count if identity is approved mid-month. Administrators can edit both global caps and set a per-user override; the override replaces the global tier cap until cleared.

Reject a new incoming payment before provider dispatch when its net wallet credit would exceed the remaining cap; a payment that lands exactly on the cap is allowed. At the cap, block only new incoming payments. Withdrawals of already available funds remain permitted under their separate balance, risk, and provider rules. Do not cancel an attempt already started: keep its capacity reserved until it reaches a verified final result.

**Why:** the user clarified that the monthly cap applies to incoming receipts only: an unverified user can receive and withdraw up to 20,000 FCFA without KYC. New incoming requests must stop at the limit, while already-started provider attempts can still settle safely.

**How to apply:** sum confirmed provider-originated wallet credits for the current UTC month, excluding manual administrator adjustments, and add active unsettled deposit reservations. Resolve the user override first, otherwise select the global cap from approved identity status. Under the merchant wallet lock, reject new deposits whose net credit exceeds the remainder before calling the provider. Never use this incoming cap to block withdrawals or transfers; enforce their independent server-side rules and let already-started deposits settle only from verified provider evidence.
