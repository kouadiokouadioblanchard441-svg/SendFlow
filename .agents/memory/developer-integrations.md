---
name: Merchant developer API
description: Product decisions for merchant API credentials, payment sessions, and webhooks.
---

The merchant-space “Développeurs” area supports both direct API checkout and SendFlow-hosted checkout. Both payment modes must reuse LinkFlow’s configured country/operator fees and aggregator routing; do not hard-code a provider in the developer API. Webhooks may be emitted only for verified final payment results, after the existing settlement path credits the merchant wallet. Public integration documentation is a later milestone.

**Why:** the user selected both integration modes and expects the same configurable payment path as LinkFlow, while the financial system must not report success without verified server-side settlement evidence.

**How to apply:** Keep session creation and success webhooks closed while `isLinkFlowPaymentExecutionEnabled` is false. Live API keys must not be issued to test accounts; implement a separate sandbox-key/provider flow before enabling API testing for those accounts. Ask before applying the additive developer schema migration to Neon.
