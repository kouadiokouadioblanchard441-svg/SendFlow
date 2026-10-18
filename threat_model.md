# Threat Model

> **Current status (2026-10-18):** The external identity provider has been removed from the application. Customer authentication continues to use SendFlow's server-owned sessions. Administrator access is fail-closed and unavailable until phone OTP and a database role are configured. The older security assessment below is a historical snapshot and does not describe the current administrator boundary.

## Project Overview

SendFlow is a mobile-first financial transfer application with a React frontend,
an Express API, and PostgreSQL storage. Customer accounts use phone/password
authentication, eSMS Verify for signup and recovery, and server-owned opaque
sessions. Administrator access is currently disabled. Didit is used by the API
server for identity verification and must not be treated as money-movement
authorization.

The consolidated pre-remediation baseline in
[SECURITY-THREAT-MODEL.md](SECURITY-THREAT-MODEL.md) covers customer OTP and
authentication, wallet and transaction access, administrator actions, Didit
webhooks, API/runtime controls, environment boundaries, dependency findings,
and the attack tests still required. It is a historical static assessment, not
a current security sign-off.

## Assets

- **Administrator sessions and role** — administrator access remains disabled until SendFlow-owned phone OTP and database authorization are configured.
- **Customer phone, name, and birth date** — new writes use authenticated
  application encryption and keyed lookup hashes. Existing plaintext rows may
  remain until the protected-data backfill is verified; this review did not
  inspect production rows.
- **Password and PIN hashes** — credentials use salted scrypt hashes and must
  never be logged or returned.
- **Customer bearer sessions and OTP challenges** — a stolen session cookie can
  impersonate a customer until expiry or revocation; a verified challenge can
  authorize signup or a recovery action for its declared purpose.
- **OTP and login security state** — attempt counters, challenge state, and
  login activity support abuse controls and incident investigation.
- **Didit credentials and webhook secret** — compromise could create fraudulent
  verification sessions or forge verification status events.
- **Identity verification state** — determines whether the account may receive
  a higher limit; forged approval could enable financial abuse.
- **Verification URLs and personal data** — verification links and provider
  identifiers are sensitive and must remain scoped to the authenticated user.
- **Wallet and transaction data** — financial balances and transfer records
  use integer minor units and require server-side authorization, idempotence,
  and auditability. Database-at-rest encryption and live SQL-constraint status
  were not independently verified in this review.
- **Development and production separation** — sandbox data and credentials must
  never be silently used for live operations.

## Trust Boundaries

- **Browser to API** — the browser is untrusted; every account and verification
  operation must be authenticated and authorized by the API.
- **Public auth endpoints to customer identity** — signup, sign-in, OTP, and
  recovery routes are Internet-facing; Origin validation is a CSRF control, not
  proof that a request came from a human or trusted client.
- **API to eSMS Verify** — customer phone numbers and OTP checks cross to a
  third-party provider; the provider response is trusted only after the API
  validates its shape and status.
- **Customer session to protected API** — the API derives the customer identity
  from a validated, database-backed cookie, never from a browser-supplied user
  identifier.
- **Didit to API webhook** — the public webhook accepts only payloads with a
  valid `X-Signature-V2`; payload fields are not trusted before validation.
- **API to Didit** — API credentials stay server-side, outbound requests use a
  fixed HTTPS host, a bounded timeout, and validated provider responses.
- **API to PostgreSQL** — identity records and webhook receipts must be updated
  transactionally, with user/session ownership enforced by server-side queries.
- **Transfer readiness boundary** — the API currently calculates transfer
  quotes only; it has no customer transfer/deposit execution endpoint or
  operator settlement path. A quote must never be presented as a completed
  money movement.
- **Development to production** — sandbox scenarios are forbidden in production;
  production requires an explicit live Didit environment configuration.

## Scan Anchors

- **Production API entry point:** `artifacts/api-server/src/app.ts`
- **Customer auth/OTP entry points:** `artifacts/api-server/src/routes/customer-auth.ts`,
  `customer-recovery.ts`, and `phone-otp.ts`
- **Customer session and OTP controls:** `artifacts/api-server/src/lib/customer-session.ts`,
  `customer-auth-rate-limit.ts`, and `customer-auth-otp.ts`
- **Customer auth persistence:** `lib/db/src/schema/customer-credentials.ts`,
  `customer-sessions.ts`, `phone-otp-challenges.ts`, and `phone-otp-events.ts`
- **Highest-risk provider code:** `artifacts/api-server/src/lib/didit.ts`
- **Highest-risk routes:** `artifacts/api-server/src/routes/identity-verification.ts`
- **Identity persistence:** `lib/db/src/schema/identity-verification.ts`
- **Authenticated user boundary:** validated SendFlow session cookies and server-side ownership checks
- **Public surface:** `/api/webhooks/didit`; it must remain signature-protected
- **Development-only UI behavior:** sandbox scenario selector in
  `artifacts/sendflow/src/pages/account-limit.tsx`

## Threat Categories

The customer authentication and OTP flows have a historical STRIDE assessment
in `SECURITY-THREAT-MODEL.md`. It is not evidence that controls have passed
route-level, concurrency, provider, or production attack testing.

### Spoofing

An attacker must not be able to create a verification session for another user
or report an approved verification. Protected routes require a validated SendFlow session,
and webhooks require both the Didit HMAC signature and a fresh `X-Timestamp`
within five minutes. The webhook secret must never be sent to the browser or
written to logs.

### Tampering

The client must not choose the verified status, Didit session ID, callback URL,
or account owner. The API creates provider sessions using the user ID derived
from the validated SendFlow session, validates provider response URLs, and applies only validated
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
state. Administrator APIs currently fail closed; do not enable them until
SendFlow OTP authentication, a database-backed administrator role, and the
separate administrator PIN are all checked by the server.

## Review Limits (2026-10-18)

- Dependency audit reported zero known vulnerabilities and SAST reported no
  findings. The privacy/data-flow scanner failed with a schema-mismatch error,
  so no clean privacy-scan result is claimed.
- Unit suites passed for security policies, authentication, OTP provider
  handling, transfer-quote calculations, sensitive-data cryptography, and
  frontend auth routing. Database concurrency tests were not run because the
  configured preview shares live Neon; they require an isolated PostgreSQL
  database.
- No production database rows, secret values, paid SMS, or live provider
  operations were inspected or exercised.