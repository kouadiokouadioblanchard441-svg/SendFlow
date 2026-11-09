---
name: Monthly wallet receipt limits
description: Monthly incoming-payment caps, identity tiers, and administrator overrides.
---

Use the sum of confirmed provider-originated XOF credits actually posted to the wallet from the start of the current UTC month. The global cap is 20,000 FCFA while identity is not approved and 4,000,000 FCFA after approval. Receipts earlier in the same month still count if identity is approved mid-month. Administrators can edit both global caps and set a per-user override; the override replaces the global tier cap until cleared.

At or above the effective cap, block withdrawals and transfers only. Continue accepting incoming payments; the total continues counting toward the monthly cap.

**Why:** the user clarified that both caps are monthly, approval changes the tier without resetting the month-to-date total, and administrators must control defaults and individual exceptions.

**How to apply:** sum confirmed provider-originated wallet credits for the current UTC month, excluding manual administrator adjustments. Resolve the user override first, otherwise select the global cap from approved identity status. Enforce outgoing blocks on the server; never reject incoming payments because of this cap.
