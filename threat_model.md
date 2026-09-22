# Threat Model

## Project Overview

SendFlow is a mobile-first financial transfer application with a React frontend,
an Express API, Clerk authentication, and PostgreSQL storage. Didit is used by
the API server for development identity verification. The current integration
is intended for Didit sandbox testing only and must not be treated as a
production money-movement authorization until authentication, verification
policy, and transfer controls are fully implemented and tested.

## Assets

- **Clerk sessions and account identity** — compromise could expose or alter a
  user's wallet, identity status, and transfer permissions.
- **Didit credentials and webhook secret** — compromise could create fraudulent
  verification sessions or forge verification status events.
- **Identity verification state** — determines whether the account may receive
  a higher limit; forged approval could enable financial abuse.
- **Verification URLs and personal data** — verification links and provider
  identifiers are sensitive and must remain scoped to the authenticated user.
- **Wallet and transaction data** — financial balances and transfer records
  require server-side authorization, idempotence, and auditability.
- **Development and production separation** — sandbox data and credentials must
  never be silently used for live operations.

## Trust Boundaries

- **Browser to API** — the browser is untrusted; every account and verification
  operation must be authenticated and authorized by the API.
- **Didit to API webhook** — the public webhook accepts only payloads with a
  valid `X-Signature-V2`; payload fields are not trusted before validation.
- **API to Didit** — API credentials stay server-side, outbound requests use a
  fixed HTTPS host, a bounded timeout, and validated provider responses.
- **API to PostgreSQL** — identity records and webhook receipts must be updated
  transactionally, with user/session ownership enforced by server-side queries.
- **Development to production** — sandbox scenarios are forbidden in production;
  production requires an explicit live Didit environment configuration.

## Scan Anchors

- **Production API entry point:** `artifacts/api-server/src/app.ts`
- **Highest-risk provider code:** `artifacts/api-server/src/lib/didit.ts`
- **Highest-risk routes:** `artifacts/api-server/src/routes/identity-verification.ts`
- **Identity persistence:** `lib/db/src/schema/identity-verification.ts`
- **Authenticated user boundary:** Clerk middleware plus `getAuth(req)` checks
- **Public surface:** `/api/webhooks/didit`; it must remain signature-protected
- **Development-only UI behavior:** sandbox scenario selector in
  `artifacts/sendflow/src/pages/account-limit.tsx`

## Threat Categories

### Spoofing

An attacker must not be able to create a verification session for another user
or report an approved verification. Protected routes require Clerk identity,
and webhooks require both the Didit HMAC signature and a fresh `X-Timestamp`
within five minutes. The webhook secret must never be sent to the browser or
written to logs.

### Tampering

The client must not choose the verified status, Didit session ID, callback URL,
or account owner. The API creates provider sessions using the authenticated
Clerk subject, validates provider response URLs, and applies only validated
webhook statuses. Status updates must not allow an older event to downgrade an
already approved session.

### Repudiation

Webhook event IDs, provider session IDs, event types, timestamps, and matching
state must be recorded. The event insert and verification update must be one
transaction so a failed update can be retried safely.

### Information Disclosure

Responses expose only the authenticated user's verification summary. Provider
credentials, session tokens, raw webhook payloads, and decision media must not
be stored or logged. API errors must not include upstream response bodies or
secrets.

### Denial of Service

The API must bound JSON request bodies and outbound Didit requests. Invalid
signatures must be rejected before database work. Verification creation must be
serialized per user to avoid duplicate provider sessions under concurrent
requests. Rate limiting and automated webhook tests remain required before
public launch.

### Elevation of Privilege

Identity approval must not be granted from client state or from an arbitrary
session ID. Higher limits and money movement must be enforced server-side from
the persisted verification state and must not rely on the visual frontend
state. The current development authentication/PIN flow is not a production
authorization control until the real account identity is connected.