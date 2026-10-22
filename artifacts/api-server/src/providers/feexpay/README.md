# FeexPay — server protocol preparation

## Operator configuration, without activation

`pnpm --filter @workspace/api-server run feexpay:configuration-plan` reads shared
Neon only and reports a fingerprint binding the current catalog and proposed
changes. It is never an automatic startup seed.

The plan uses exact identities, including TMoney → Togocom and Flooz → Moov in
Togo. It prepares 49 explicit operator/operation routes across all six countries
and three missing operators, all disabled. Coris Bénin is deposit-only. The MTN
Congo/XAF route is provider metadata only; SendFlow remains XOF-only, so this
country cannot be used until XAF is implemented and separately enabled.
Undocumented operators such as Telecel Burkina Faso or Airtel Congo receive no routes.

Country defaults are not changed: these operator routes are explicit exceptions
and take precedence over a future country default. An administrator must
explicitly change an operator's assignment to inherit the country default again.
No existing logos, rates, admin permissions, activation flags, secrets or
financial records are changed. New operators receive no invented rate or
substituted logo.

Only after explicit permission to write shared Neon, the command accepts
`--apply --confirm-shared-neon --expected-hash=<reviewed fingerprint>`.
A serializable transaction audits each insert and rejects stale plans and
conflicting manual choices. Errors before commit roll back the entire import;
an uncertain SQL commit requires reconciliation, never a blind retry.
Re-applying a freshly reviewed, up-to-date plan is a no-op.

`pnpm --filter @workspace/api-server run test:feexpay-configuration` exercises
coverage, duplicate/concurrent imports, unchanged prices and audit-failure
rollback against disposable local PostgreSQL, without using Neon or FeexPay.

## Scope

This client is not a payment execution service. No public money-moving endpoint,
worker, webhook settlement or wallet write invokes it yet. Administrator
`prepared` means protocol preparation, never payment activation.

Official documentation reviewed on 2026-10-22:

- https://docs.feexpay.me/?section=api-rest-integrations&version=v2
- https://docs.feexpay.me/?section=services-payout&version=v2
- https://docs.feexpay.me/?section=api-rest-status&version=v2
- https://docs.feexpay.me/?section=api-payout-status&version=v2
- https://docs.feexpay.me/?section=webhook&version=v2
- https://docs.feexpay.me/?section=sandbox&version=v2

The official Postman export describes 17 Mobile Money collection channels and
16 disbursement channels in BJ, BF, CI, SN, TG and CG. Coris BJ has no documented
payout in that export. Sandbox does not simulate Coris BJ or the Burkina Faso
channels. XAF (Congo) remains blocked by SendFlow's current XOF-only execution
envelope. Payment cards and PI-SPI are outside this Mobile Money implementation.

`catalog.ts` records protocol coverage, not merchant entitlements, telephone
numbering plans, fees, country activation or operator activation. Existing
database settings remain authoritative and unchanged. No global country or
operator is inserted/enabled automatically.

## Credentials and execution

Do not put values in source files, browser configuration or this document.
No environment variable is provisioned automatically by this implementation.

- Replit tests: mocked transport, with generated synthetic credentials.
- Project direction: direct production API integration, not an official sandbox
  integration. Do not request or provision sandbox credentials for this project.
  Protocol fixtures use an injected transport and never contact either endpoint.
- Future Plesk live execution: `FEEXPAY_MODE=live`, `FEEXPAY_API_KEY`,
  `FEEXPAY_SHOP_ID`, `FEEXPAY_EXECUTION_HOST=plesk`,
  `FEEXPAY_LIVE_ENABLED=true` and production runtime, after explicit approval.
- Return/cancel URLs, if used: exact HTTPS `FEEXPAY_RETURN_ORIGIN` configured
  server-side. They never confirm a payment.

Live calls are blocked in development, shared-Neon preview and Replit runtimes.
Before activation, FeexPay must authorize Plesk's actual outbound IP; the web
domain or an assumed proxy IP is not sufficient.

## Required before financial execution

Persist the selected provider, channel, immutable amounts, currency, reference
and unique operation key **before** dispatch. A timed-out POST has an unknown
outcome: never blindly retry or release reserved funds. Reconcile it.

A successful request is not financial settlement. Match authenticated status
against the stored provider reference, expected amount, direction, merchant and
currency/channel. Missing evidence requires reconciliation, not inferred success.
Webhook payloads and browser callbacks cannot authorize ledger writes.

Implement atomic reservation/credit/debit, exactly-once accounting, a durable
dispatch journal, duplicate/out-of-order webhook handling, reconciliation,
limits, audit and controlled compensation before connecting customer submission.
The generic conservative SDK amount envelope (100–2,000,000) does not replace
verified operator limits, KYC limits or admin-configured fees.

Per-channel liquidity, merchant country/operator entitlements, provider fees,
OTP requirements and redirect-based collection behavior must be confirmed
against the actual merchant account. Any live verification that could initiate
an operation requires explicit authorization. Documentation coverage alone is
not proof they are enabled for the merchant.

## Local verification

`node --experimental-strip-types --test src/providers/feexpay/client.test.mjs`

These tests use an injected in-memory transport and make no provider requests.
