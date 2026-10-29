---
name: SendFlow payment minimum
description: Product rule for the minimum amount on CFA payment intake.
---

The minimum for XOF/XAF LinkFlow link amounts is 200 FCFA. Customer deposit quotes in XOF also enforce this floor. The initial minimum for XOF payouts is 200 FCFA and is configurable by an authorized administrator. Keep server-side validation authoritative and make matching checkout UI and developer documentation clear. Preserve existing thresholds for non-CFA currencies and unrelated transfer operations unless the owner changes that scope. Do not rewrite historical payment-link records; reject a new payment attempt for a fixed CFA link below the minimum.

**Why:** the product owner set 200 FCFA for deposits and later confirmed 200 FCFA as the initial configurable payout minimum, while requiring existing data and payment behavior to remain protected.

**How to apply:** check each affected server entry point, its client-side validation, and its documentation together; never rely on frontend validation alone.
