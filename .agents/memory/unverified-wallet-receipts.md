---
name: Unverified wallet receipt threshold
description: The account eligibility rule tied to cumulative wallet receipts before identity approval.
---

Count successful amounts actually credited to a wallet while the account has no approved identity dossier. The initial administrator-configured threshold is 20,000 FCFA. At or above it, block withdrawals and transfers until identity approval; continue accepting incoming payments.

**Why:** the user explicitly set this threshold and the incoming-versus-outgoing behavior.

**How to apply:** use cumulative credited receipts rather than current balance, and enforce the gate on the server for outgoing operations only.
