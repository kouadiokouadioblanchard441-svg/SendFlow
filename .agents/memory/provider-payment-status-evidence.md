---
name: Provider payment status evidence
description: Official FeexPay and PayDunya status fields required before settling incoming payments.
---

Never credit a wallet from a payment-creation response or webhook alone. FeexPay's documented v2 status response can omit currency; keep that provider field absent and correlate the authenticated status lookup to the exact reference, amount, payer phone, and server-selected XOF channel. PayDunya's invoice-status response includes a SHA-512 hash of the configured Master Key; verify it in constant time and match invoice token, amount, SendFlow reference, and payer phone before finalizing.

Provider documentation establishes API shape, not merchant eligibility or enabled channels. Production routes must also have the merchant's real credentials, account entitlements, explicit provider routing, and the correct Plesk environment.

**Why:** the provider contracts expose different proof fields, and treating an initial acknowledgement or callback as final can credit funds without a verified transaction.

**How to apply:** use the current official provider documentation for every new or changed payment flow; do not enable production routes until credentials and account-specific channel access are confirmed.
