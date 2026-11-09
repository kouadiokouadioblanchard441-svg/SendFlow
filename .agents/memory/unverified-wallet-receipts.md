---
name: Monthly wallet receipt limits
description: Monthly incoming-payment caps, identity tiers, and administrator overrides.
---

Use the sum of confirmed provider-originated XOF credits actually posted to the wallet from the start of the current UTC month. Also reserve capacity for active, unsettled provider deposits so concurrent attempts cannot exceed the cap. The global cap is 20,000 FCFA while identity is not approved and 4,000,000 FCFA after approval. Receipts earlier in the same month still count if identity is approved mid-month. Administrators can edit both global caps and set a per-user override; the override replaces the global tier cap until cleared.

Reject a new incoming payment when its net wallet credit would exceed the remaining cap; a payment that lands exactly on the cap is allowed. At the cap, block both new incoming payments and outgoing withdrawals/transfers. Do not cancel an attempt already started: keep its capacity reserved until it reaches a verified final result.

**Why:** the user changed the rule so no new payment works after the monthly cap is reached and confirmed that a payment must be rejected if it would exceed the cap. Pending reservations prevent concurrent overspending while existing provider attempts can still settle safely.

**How to apply:** sum confirmed provider-originated wallet credits for the current UTC month, excluding manual administrator adjustments, and add active unsettled deposit reservations. Resolve the user override first, otherwise select the global cap from approved identity status. Under the merchant wallet lock, reject new deposits whose net credit exceeds the remainder; enforce incoming and outgoing blocks on the server. Let already-started attempts settle only from verified provider evidence.
