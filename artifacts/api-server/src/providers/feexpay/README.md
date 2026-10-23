# FeexPay — direct server-side REST API (Payin and Payout)

## Integration type

SendFlow's intended integration is a direct REST API client running on the
server. It is **not** a FeexPay-hosted checkout page or checkout session, and it
does not create or consume a hosted-checkout URL. The word “SDK” in project
discussions means this server-side API client, not a browser SDK. Any channel-
specific customer authorization step remains separate from a hosted checkout.

The protocol code is in `client.ts`; channel paths and operation coverage are
in `catalog.ts`. The browser must never receive the FeexPay key or call these
endpoints directly.

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

## Current implementation status

`FeexpayClient` is a protocol client, **not yet an end-to-end payment
integration**. A source search found no production route or worker invoking
`initiate()` or `getStatus()`; the client is invoked only by its mocked tests.
The payment-intent, attempt, confirmation and wallet-reservation schemas and
their SQL guards exist; see `lib/db/migrations/payment-execution-structures.md`.
They are not yet connected to an application execution service. There is no
FeexPay webhook settlement handler or status-polling worker invoking this client,
and no customer payment route orchestrating dispatch and ledger settlement.
The administrator's
`adapterStatus: "prepared"` means configuration/protocol preparation only. It
does not mean that customer Payin or Payout works or that the provider is
activated.

### Customer-page boundary

The existing deposit, inter-network and international forms are SendFlow pages,
not provider checkout pages. Customer submission is currently disabled by
`artifacts/sendflow/src/lib/transaction-readiness.ts`; the transfer-quote route
only validates and calculates a quote, and does not initiate payment.

Keep the existing page appearance when connecting payment execution. The
browser must submit user inputs to an authenticated SendFlow endpoint, not call
the provider directly or receive provider credentials/raw errors. The server
must select the configured provider, compute authoritative amounts, persist
idempotent dispatch state, verify provider status, and settle the ledger before
reporting success. Customer responses, receipts and history must use SendFlow
wording, without exposing internal provider routing. A mobile-money
authorization step required by a channel is not evidence of completed payment.

## Direct API protocol represented in source

| Operation | Direct server request | Current request body |
| --- | --- | --- |
| Payin | `POST /api/transactions/public/requesttopay/{catalog-path}` | `shop`, integer `amount`, `phoneNumber`, `callback_info`; `description` and `otp` where configured |
| Payout | `POST /api/payouts/public/{catalog-path}` | `shop`, integer `amount`, `phoneNumber`, `callback_info`, `motif`; `network` for shared-network routes |
| Payin status | `GET /api/transactions/public/single/status/{provider-reference}` | No body |
| Payout status | `GET /api/payouts/status/public/{provider-reference}` | No body |

The catalog supplies each operation's exact path; `FEEXPAY_MODE` selects
`https://api-v2.feexpay.me` for live mode or `https://sandbox-api.feexpay.me`
for sandbox mode. All requests use the server-side Bearer credential; POST
bodies are JSON. The status URLs are provider-reference lookup endpoints, not
checkout callbacks. FeexPay documents `PENDING`, `SUCCESSFUL`, and `FAILED`;
the client also normalizes `IN PENDING STATE` to `PENDING`. FeexPay requires
Payout status verification before treating a payout as final. A `PENDING`
response is never a successful financial settlement.

The Payin client currently accepts optional `returnUrl` and `cancelUrl` inputs
and serializes them as `return_url` and `cancel_url`. Those fields were not
listed in the direct REST Payin request fields reviewed below. They are not a
checkout flow, but their support by the direct API is **unverified**; do not
configure or rely on them until FeexPay confirms them. The client also currently
sends `callback_info` for Payout; confirm that field is accepted on each Payout
route before depending on it for reconciliation.

The code currently applies the same conservative amount envelope
(`100–2,000,000`) to both operations. FeexPay's Payin documentation specifies
that range; the accessible Payout documentation gives a different minimum for
at least one route. Therefore this shared client envelope is not proof of
Payout limits for every channel. Similarly, the client checks a country prefix
and a general digit length, not each operator's documented phone-number
format.

Official documentation checked on 2026-10-23:

- https://docs.feexpay.me/?section=api-rest-integrations&version=v2
- https://docs.feexpay.me/?section=services-payout&version=v2
- https://docs.feexpay.me/?section=api-rest-status&version=v2
- https://docs.feexpay.me/?section=api-payout-status&version=v2
- https://docs.feexpay.me/?section=webhook&version=v2
- https://docs.feexpay.me/?section=sandbox&version=v2

The source catalog contains 17 collection channels and 16 disbursement channels
in BJ, BF, CI, SN, TG and CG; it does not invent a Coris BJ payout. The official
Payin page and status pages were readable. The official Payout page is
JavaScript-rendered and returned only a loading screen to the documentation
fetcher; search-indexed excerpts confirmed the status URL and some channel
details, but did not independently verify every catalog path or network value.
Treat the remaining Payout channel mapping as unverified until checked against
the complete official table or FeexPay merchant support.

XAF (Congo) remains blocked by SendFlow's current XOF-only execution envelope.
Payment cards and PI-SPI are outside this Mobile Money integration.

`catalog.ts` records protocol coverage, not merchant entitlements, telephone
numbering plans, fees, country activation or operator activation. Existing
database settings remain authoritative and unchanged. No global country or
operator is inserted/enabled automatically.

## Credentials and execution

Do not put values in source files, browser configuration or this document.
No environment variable is provisioned automatically by this implementation.

- Automated protocol tests: injected mock transport and generated synthetic
  credentials; they make no request to either live or sandbox FeexPay.
- The client has separate explicit `live` and `sandbox` configuration paths.
  The intended integration is direct REST, not a hosted checkout. Selecting a
  mode in configuration does not prove merchant access or enable money movement.
- Plesk live execution: `FEEXPAY_MODE=live`, `FEEXPAY_API_KEY`,
  `FEEXPAY_SHOP_ID`, `FEEXPAY_EXECUTION_HOST=plesk`,
  `SENDFLOW_DATABASE_TARGET=production`, `FEEXPAY_LIVE_ENABLED=true` and
  production runtime, after explicit approval.
- Replit real-payment testing has been explicitly authorized by the user.
  The user explicitly requires the currently connected real Neon database, not a
  separate preview database. It requires `FEEXPAY_EXECUTION_HOST=replit`,
  `SENDFLOW_REPLIT_LIVE_APPROVED=true`,
  `SENDFLOW_SHARED_NEON_LIVE_APPROVED=true`,
  `SENDFLOW_DATABASE_TARGET=shared-neon`, and the
  `NEON_DATABASE_URL_PRODUCTION` secret configured in the server runtime.
  If that secret is absent, live authorization fails closed; its current
  availability must not be inferred from this documentation.
  `NEON_DATABASE_URL_PREVIEW` is not required. Connections enforce
  `sslmode=verify-full`. This configuration never grants access to private routes,
  makes a viewer financially eligible, migrates schemas, or moves funds.
  The existing shared-Neon access middleware remains in force.
  Keep `FEEXPAY_LIVE_ENABLED=false` until the complete server payment lifecycle,
  account entitlements and environment readiness have been verified.
- Do not configure or send return/cancel URLs until FeexPay confirms they are
  supported by the direct REST Payin endpoint. A browser return never confirms
  a payment.

Live calls remain blocked on unapproved shared-Neon previews, managed development
databases, unapproved runtimes and whenever the live switch is off. Environment authorization
is not payment readiness: the existing customer submission lock must remain until
the transfer service is operational. No call is made just by configuring a host.
Before activation, verify FeexPay's authorization of the executing server's actual
outbound IP (Plesk or Replit); the web domain or an assumed proxy IP is not sufficient.

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
The generic conservative client amount envelope (100–2,000,000) does not replace
verified operator limits, KYC limits or admin-configured fees.

Per-channel liquidity, merchant country/operator entitlements, provider fees,
OTP requirements and channel-side customer authorization behavior must be
confirmed against the actual merchant account. Any live verification that could initiate
an operation requires explicit authorization. Documentation coverage alone is
not proof they are enabled for the merchant.

## Local verification

`node --experimental-strip-types --test src/providers/feexpay/client.test.mjs`

These tests use an injected in-memory transport and make no provider requests.
