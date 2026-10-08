# Security Threat Model — Customer OTP and Authentication

**Assessment stage:** threat-model baseline, before remediation  
**Scope:** customer phone OTP, signup, password sign-in, server sessions,
PIN unlock, and password/PIN recovery.  
**Assessment date:** 2026-10-08  
**Method:** code and schema inspection plus existing unit tests. No route-level
attack was sent, no real SMS was sent, and no account or database row was
created or changed for this assessment.

## Executive assessment

The implementation has meaningful server-side controls: purpose-bound OTP
challenges, provider-side code checking, database-backed challenge state,
single-use recovery/signup verification, hashed opaque session tokens,
HttpOnly/Secure cookies, scrypt credential hashes, and per-phone/requester
limits for OTP issuance. Several of these protections are visible in code, but
the current test suite does not exercise the HTTP routes, persistent challenge
state, or concurrent requests.

This baseline is **not a security sign-off**. The highest-priority items to
validate or remediate are:

1. With SMS signup verification enabled, `/auth/register` runs the expensive
   scrypt password hash before it checks whether the supplied OTP challenge is
   valid. That path has no registration-specific rate limit. Invalid challenge
   requests can therefore consume significant CPU and memory.
2. Password sign-in checks the rate-limit buckets before hashing/verifying the
   password, but the complete attempt is not serialized. Concurrent requests
   can all pass the pre-check before any failed attempt is recorded.
3. Customer passwords are accepted at four characters, and the normal
   sign-in flow is password-only. Successful authentication creates a
   30-day session.
4. An administrator can disable signup SMS verification. In that mode signup
   creates an active account and wallet with `phoneVerifiedAt = null`. The
   auth routes do not establish that every financial operation separately
   blocks such an account; that must be proven in the transaction threat model.
5. Registration responses distinguish an already-used phone number from a
   newly-created account.
6. A customer can revoke the current session by signing out; the inspected
   customer routes do not provide a way to list and revoke other sessions.

These are source-based findings. The attack cases below are **test plans, not
executed proofs**. Route-level and database-concurrency tests are required
before describing any of them as fixed or blocked.

## System and trust boundaries

Customer identity is separate from administrator identity. Customer routes use
the custom phone/password/session flow; Clerk is initialized at the API layer
but is the administrator authentication system.

### Boundaries

1. **Browser or other HTTP client → Express API:** all request bodies,
   `Origin`, cookies, user-agent, and forwarded-IP headers are untrusted.
2. **Express API → PostgreSQL:** account identity, credentials, OTP challenge
   state, rate-limit state, sessions, and login events are persisted here.
3. **Express API → eSMS Verify:** the API sends a phone number to start
   verification and submits a provider verification ID plus a six-digit code
   for checking. Provider credentials remain server-side.
4. **Customer session → protected API:** a customer cookie is a bearer
   credential; the API validates its hash and session state in PostgreSQL on
   each session lookup.
5. **Reverse proxy → Express API:** `trust proxy` is set to one hop and
   `req.ip` is used in rate-limit buckets and login records. The safety of this
   control depends on the actual proxy chain stripping untrusted forwarding
   headers. Replit's and the future Plesk production proxy behavior have not
   been externally tested here.
6. **Customer → administrator:** Clerk-protected administrator routes are a
   separate privilege boundary. This assessment does not certify those routes.

## Data-flow diagrams

### OTP issuance and checking

```mermaid
sequenceDiagram
    actor C as Customer client
    participant API as Express API
    participant DB as PostgreSQL
    participant SMS as eSMS Verify
    C->>API: POST /api/auth/send-otp (phone, purpose, Origin)
    API->>API: Validate Origin and Zod body
    API->>DB: Lock phone + requester buckets; enforce cooldown/hour limits
    API->>DB: Reserve challenge + send event (starting)
    API->>SMS: Start verification (phone, server credentials)
    SMS-->>API: verification_id + pending status
    API->>DB: Store provider ID; mark challenge pending
    API-->>C: challengeId + expiry + resend delay
    C->>API: POST /api/auth/verify-otp (challengeId, purpose, code)
    API->>DB: Lock challenge; reserve one of at most five checks
    API->>SMS: Check provider ID + code
    SMS-->>API: approved / not approved
    API->>DB: Persist verified/failed state and event
    API-->>C: Verification result
```

### Signup and customer session issuance

```mermaid
sequenceDiagram
    actor C as Customer client
    participant API as Express API
    participant DB as PostgreSQL
    C->>API: POST /api/auth/register (profile, password, challengeId)
    API->>API: Validate Origin, input, age and privacy acceptance
    API->>DB: Read signup policy
    API->>API: Derive scrypt password hash
    API->>DB: Lock signup policy row; validate + consume OTP if required
    API->>DB: Create user, credentials, wallet, session, login event atomically
    API-->>C: Account summary + __Host-sendflow_session cookie
```

### Password sign-in and protected session

```mermaid
sequenceDiagram
    actor C as Customer client
    participant API as Express API
    participant DB as PostgreSQL
    C->>API: POST /api/auth/sign-in (phone, password)
    API->>API: Validate Origin and body
    API->>DB: Check phone/requester lockout buckets
    API->>DB: Read account and password hash
    API->>API: Verify scrypt hash (dummy hash for unknown account)
    API->>DB: Recheck account/hash under transaction; create session + login event
    API-->>C: Account summary + __Host-sendflow_session cookie
    C->>API: Authenticated request (cookie)
    API->>DB: Hash cookie token; validate expiry/revocation/account status
    API-->>C: Authorized response or 401/403
```

### Password/PIN recovery

```mermaid
sequenceDiagram
    actor C as Customer client
    participant API as Express API
    participant DB as PostgreSQL
    participant SMS as eSMS Verify
    C->>API: Request OTP with password_reset or pin_reset purpose
    API->>DB: Reserve purpose-bound challenge
    API->>SMS: Start and later check provider verification
    SMS-->>API: Approval
    API->>DB: Store verified challenge
    C->>API: POST /api/auth/reset-password or /reset-pin
    API->>DB: Lock verified challenge; match phone, purpose, expiry; consume once
    API->>DB: Update credential and revoke all customer sessions
    API-->>C: Generic success response
```

## Assets

| Asset | Where / current handling | Security impact |
| --- | --- | --- |
| Customer phone number | Plaintext in `sf_users.phone`; HMAC fingerprint in OTP and rate-limit tables | Account identity and recovery factor; disclosure enables targeted phishing/SIM-swap attempts |
| Name, birth date, country | `sf_users`; registration requires adult birth date and privacy acceptance | Personal data; no encryption-at-rest control was observed in the inspected schema |
| Customer password and PIN | Salted scrypt encodings in `sf_customer_credentials` | Compromise enables account takeover; a four-digit PIN has low offline entropy even when hashed |
| Session cookie | Random 32-byte bearer token, `__Host-` + HttpOnly + Secure + SameSite=Lax; only SHA-256 hash stored | Theft allows impersonation until revocation/expiry |
| OTP challenge and provider ID | UUID, HMAC phone/requester fingerprints, purpose, provider verification ID, attempts, expiry and consumption state | A verified, unconsumed challenge authorizes one signup/recovery operation |
| eSMS credentials | Server environment variables | Compromise enables fraudulent or costly verification operations |
| `SESSION_SECRET` | Server environment variable; HMAC key for phone/requester fingerprints | Compromise enables correlation/forgery of keyed fingerprints; rotation invalidates current fingerprint matching and resets effective rate-limit identities |
| Rate-limit and audit state | PostgreSQL attempt buckets, OTP events, login events | Needed to constrain guessing and investigate account access; loss or tampering weakens detection |
| Account/wallet ownership | User ID and wallet are created during signup | Incorrect identity binding can expose or authorize another customer's data or money |

## Threat actors

- **Unauthenticated external attacker or bot:** can call public auth endpoints,
  automate requests, rotate source IPs, and forge ordinary HTTP headers such as
  `Origin` from a non-browser client.
- **Credential-stuffing attacker:** has reused/leaked passwords and targets
  phone-number accounts.
- **Malicious customer or account holder:** can automate OTP/PIN guesses,
  exploit recovery, or abuse signup and session endpoints.
- **Targeted attacker with victim phone access:** may exploit SIM swap,
  interception, social engineering, or a compromised device to receive OTPs.
- **Cross-site attacker:** tries to make a customer's browser submit
  cookie-bearing state changes from an untrusted origin.
- **Database reader or operator with excessive privileges:** can access
  plaintext customer phone/profile data and session/OTP metadata; can tamper
  with application state if write access is obtained.
- **Compromised eSMS account/provider path:** can expose phone numbers, issue
  fraudulent approvals, or deny service.
- **Hostile or misconfigured reverse proxy:** can cause attacker-supplied
  forwarding headers to influence IP-based rate limiting and audit records.
- **Rogue administrator:** can alter the SMS signup policy or inspect OTP
  activity. This risk requires a separate administrator threat model; the
  customer OTP routes do not themselves establish admin control quality.

## Flows and existing controls

### 1. OTP send and verify

**Existing controls observed**

- `SendPhoneOtpBody` accepts an E.164-like phone string and a fixed purpose
  enum; `VerifyPhoneOtpBody` requires a UUID, the same purpose enum, and exactly
  six decimal digits (`lib/api-zod/src/generated/api.ts`).
- The API requires an exact configured Origin for send/verify. CORS is not the
  only guard: `isTrustedOrigin` rejects missing or unlisted origins. This helps
  against browser CSRF, but is not client authentication; a script can set an
  allowed `Origin` header.
- Phone and requester values are HMAC-fingerprinted with `SESSION_SECRET`;
  raw phone numbers and OTP codes are not stored in the challenge table.
- Per phone, the API allows at most five OTP starts per hour and enforces a
  60-second resend cooldown. Per requester IP, it allows at most 60 starts per
  hour. Sorted PostgreSQL advisory transaction locks serialize those
  reservations across API instances.
- A challenge expires after five minutes. The API allows at most five code
  checks per challenge; each attempt is reserved while the challenge row is
  locked. Provider failures release a reserved attempt only if the reservation
  is still current.
- A new active challenge supersedes the previous pending challenge. The
  provider verification ID is unique in the schema.
- The API calls a fixed HTTPS eSMS endpoint with a ten-second timeout. It
  accepts only the expected response structure/status and sanitizes provider
  messages before logging or storing them.
- OTP completion events record send/verify outcome, provider HTTP status,
  attempt number, and timestamps.

**Effective against:** trivial malformed payloads; cross-origin browser forms
from an unlisted origin; reuse of an expired, superseded, consumed, or
wrong-purpose challenge; more than five checks against one challenge; and
ordinary repeated sends to one phone or one observed IP.

**Not established by the current tests:** correct route behavior under parallel
requests, limits across multiple API instances, real eSMS delivery/approval,
IP attribution behind Replit/Plesk proxies, or log/retention behavior over
time. The eSMS tests use stubbed `fetch`; they do not contact the provider.

**Residual risks:** the challenge ID is a bearer-like identifier until the
challenge expires or is consumed and is not bound to a browser session. The
verification limit is challenge-scoped rather than a separate global
verification-endpoint limit. Distributed attackers can still exhaust the
phone-level allowance and deny the legitimate owner a new code. OTP challenge
and event rows are marked or appended in the inspected routes; no cleanup or
retention job was found in the inspected call sites, so database growth and
retention need separate verification.

### 2. Signup and phone ownership

**Existing controls observed**

- When `smsVerificationEnabled` is true, signup requires a verified,
  unexpired, unconsumed challenge matching the exact phone fingerprint and
  `signup` purpose. The challenge is row-locked and consumed inside the same
  transaction that creates the account.
- The signup policy row is share-locked during the transaction, serializing
  registration with an administrator changing the SMS policy.
- User, credentials, wallet, session and login event are created in one
  transaction. The unique phone constraint plus handling of PostgreSQL
  duplicate-key errors prevents two successful accounts for the same phone.
- Signup validates name shape, adult birth date and privacy acceptance.
- When SMS verification is disabled, the route deliberately creates the
  account with `phoneVerifiedAt = null`; it also writes phone/requester
  attempt buckets.

**Effectiveness and gap:** the transaction makes successful OTP consumption
and account creation atomic. The disabled-SMS mode is an explicit exception to
proof of phone ownership, not a verified identity. The account is still created
with active status and a wallet. This assessment has not inspected every
financial operation, so it cannot prove that an unverified account is denied
money movement. That is a release-blocking question for the transaction
threat model.

The registration response explicitly says when a phone is already associated
with an account (`409`); therefore account enumeration is possible in the
relevant signup mode. In addition, with SMS verification enabled the route
derives the expensive scrypt password hash before it validates/consumes the
challenge, and no registration-specific rate limiter was observed on that
branch. The public caller can submit syntactically valid but invalid challenge
IDs and repeatedly trigger password hashing.

### 3. Password sign-in, sessions and PIN unlock

**Existing controls observed**

- Passwords and PINs use Node `scrypt` with `N=32768`, `r=8`, `p=1`, 16-byte
  random salts, a 64-byte derived key, and constant-time comparison.
- Unknown-account sign-in verifies against a dummy scrypt hash, while
  registered and unregistered failures share the same `401` message.
- Login attempts have phone and requester-IP HMAC buckets. Five failures in a
  15-minute window result in a 15-minute block. Successful sign-in clears those
  buckets.
- Sign-in rechecks the account status, phone, and password-hash version inside
  a transaction before creating a session.
- Session tokens contain 32 random bytes. Only a SHA-256 token hash is stored.
  The cookie is named `__Host-sendflow_session` and uses HttpOnly, Secure,
  SameSite=Lax, path `/`, and no Domain attribute.
- Session lookup checks token hash, revoked state, expiry, and active account
  status in PostgreSQL. Inactive accounts are revoked. Signout revokes the
  current session. Password and PIN recovery revoke all active sessions.
- PIN unlock uses a 15-minute server-side deadline. PIN check attempts lock
  sorted account/requester advisory-lock buckets before reading/updating
  failure state, avoiding the pre-check race for this path.
- `/api/auth` responses are marked private/no-store. The HTTP request logger
  omits query strings and body data; configured redaction covers authorization,
  cookie, and set-cookie headers.

**Effectiveness and gaps:** server-side session ownership and cookie controls
substantially reduce token prediction, database-only token replay, and
client-supplied-user-ID attacks. The four-character password minimum allows
very low-entropy passwords. A successful password alone creates a session
lasting up to 30 days; phone OTP is not required at each sign-in. PIN unlock
adds a session-specific step for routes that explicitly require it, but it is
not a transaction PIN bound to amount/recipient, and not every protected route
was audited here.

The password rate limiter is checked before expensive verification, but
sign-in attempts are not enclosed in the advisory lock used by PIN checks. A
parallel burst can therefore have many requests pass the initial check before
failures are written. The persistent counters may block subsequent attempts,
but this does not prove that the in-flight burst was limited.

The inspected customer routes provide signout of the current session; no
customer endpoint to list/revoke other active sessions was found. A stolen
cookie may therefore remain usable until the user signs out that device,
resets credentials, the session is otherwise revoked, or its 30-day expiry.

### 4. Password and PIN recovery

**Existing controls observed**

- Recovery requires an OTP challenge whose HMAC phone fingerprint, purpose,
  verified status, `phoneVerified` flag, expiry, and `consumedAt` state all
  match.
- The challenge is rechecked and row-locked inside the credential-update
  transaction, then marked consumed.
- Recovery uses generic success responses for unknown/inactive accounts.
- Password and PIN recovery revoke all active sessions and clear their
  `pinVerifiedUntil` state.

**Effectiveness and gaps:** purpose binding and one-time consumption prevent
using an OTP for signup to reset a PIN/password or replaying one successful
recovery. The recovery schemas allow passwords of four characters and PINs of
four digits. No route-level tests prove concurrent recovery requests cannot
consume the same challenge twice or verify full session revocation.

## STRIDE assessment

### OTP flow

| Category | Threat in this flow | Existing control and actual effectiveness | Remaining requirement |
| --- | --- | --- | --- |
| **Spoofing** | An attacker claims control of a phone or fabricates provider approval. | The API checks codes with eSMS, stores provider verification IDs server-side, and validates provider response shape/status. This is stronger than accepting a client boolean, but has only stub-provider unit coverage. | Verify real sandbox delivery and approval, provider account controls, and that financial actions require verified ownership. |
| **Tampering** | Change phone, purpose, attempt count, expiry, or verified state to reuse a challenge. | Zod constraints, HMAC phone match, purpose-bound state, row locks, database constraints, and transactional consumption block ordinary request tampering. No route/DB attack test exercises these invariants. | Test wrong phone/purpose, replay after consumption, expired challenge, and parallel use against isolated PostgreSQL. |
| **Repudiation** | Deny requesting/checking an OTP or dispute the result. | OTP event records event type, outcome, attempt number, provider status and time. | Events do not record requester IP/user-agent or a durable actor identity, and no tamper-evident storage/retention guarantee was observed. Treat this as operational telemetry, not non-repudiation evidence. |
| **Information disclosure** | Expose phone, code, provider ID, or account status. | Challenge stores an HMAC phone fingerprint rather than phone/code; provider messages are sanitized; request body is not serialized by the HTTP request logger. | `sf_users.phone` is plaintext; provider receives the phone; challenge ID/provider ID handling and all error logs have not been penetration-tested. |
| **Denial of service** | Burn SMS credit, block a victim's phone, or exhaust API/database capacity. | Five sends per phone/hour, 60 per requester/hour, 60-second cooldown, five checks/challenge, 100-KB JSON limit, and 10-second provider timeout constrain several paths. | No global auth limiter; distributed IPs can hit the phone cap; signup scrypt path can be triggered with invalid challenges; challenge/event retention is unknown. |
| **Elevation of privilege** | Use signup OTP as recovery OTP, or use unverified phone ownership to access financial operations. | Purpose-bound challenge queries prevent purpose substitution. Disabled-SMS signup explicitly leaves phone unverified. | Must prove every financial route rejects unverified accounts; the check is outside this phase and is not assumed. |

### Customer authentication and session flow

| Category | Threat in this flow | Existing control and actual effectiveness | Remaining requirement |
| --- | --- | --- | --- |
| **Spoofing** | Impersonate a customer with guessed/stolen password, PIN, or cookie. | scrypt, dummy hash, generic sign-in errors, opaque random server session, hashed token storage, DB revocation checks, and PIN lockout. Cookie flags and code paths are present. | Password minimum is four characters; password-only sign-in yields a 30-day session; login limiter is not concurrency-serialized; no complete session-revocation UI/API. |
| **Tampering** | Substitute another user ID, account state, or credential during auth. | Protected session identity comes from the cookie lookup; sign-in rechecks account/hash under a transaction; account creation consumes OTP atomically; account status is checked. | Add route-level tests for foreign IDs/cookies and races with credential changes; do not rely on client-side state. |
| **Repudiation** | Deny a sign-in, signout, PIN change, or recovery. | Successful signup/sign-in records IP, user-agent and coarse browser/device/OS classifications. | Failed logins and signouts are not recorded in this login-events table; user-agent is client-controlled; logs/events are not shown to be immutable or retention-controlled. |
| **Information disclosure** | Enumerate accounts or expose PII, credential/session material, or account state. | Sign-in uses a generic 401 and dummy hash; auth responses are no-store; cookie/auth headers are redacted; password/PIN hashes are stored instead of plaintext. | Signup returns a distinct existing-phone 409; user phone and profile PII are plaintext at rest; generic log masking is not proven end-to-end. |
| **Denial of service** | Exhaust CPU/memory with scrypt or lock out customers. | JSON request body is capped at 100 KB; sign-in/PIN buckets block repeated failures; PIN attempts are serialized across instances. | Invalid signup challenges can trigger scrypt without a registration limiter; concurrent sign-in attempts can all pass the initial rate check; no global API rate limit was observed. |
| **Elevation of privilege** | Turn a customer session into another user's session or access an action without required PIN/ownership. | Server derives identity from the cookie and routes can require server-side PIN unlock; admin Clerk auth is separate. | No claim is made about wallet/transfer authorization until all such routes are checked. SMS-disabled accounts are active while unverified; PIN unlock is not amount/recipient-bound transaction authorization. |

## Prioritized attack cases and proof status

The following are baseline scenarios to add to `tests/security/` and run only
against an isolated test database and provider stub/sandbox. They were **not
executed** during this threat-model phase.

| ID / priority | Objective and method | Expected baseline behavior from code | Required post-remediation proof |
| --- | --- | --- | --- |
| **OTP-AUTH-01 / High** | Cause resource exhaustion: send parallel `POST /api/auth/register` requests with valid schema fields but a fresh random/nonexistent `challengeId`, while SMS signup verification is enabled. Include an allowed `Origin`; a non-browser client can forge this header. | The route hashes the supplied password with scrypt before it locks and validates the challenge. The request then fails with `409`; no registration-specific limiter was observed on the SMS-enabled branch. This prediction is source-derived, not measured. | A route test proves invalid/unverified challenges are rejected before expensive password hashing; a bounded-concurrency test proves per-phone/IP limits apply before hashing and create no account/session/wallet. |
| **OTP-AUTH-02 / High** | Race the login limiter: send many parallel bad-password `POST /api/auth/sign-in` requests for one isolated test phone from one source IP. | Each request may pass `getAuthRateLimit` before concurrent failures are recorded; in-flight scrypt work is not serialized. This prediction is source-derived, not measured. | Parallel test proves no more than the configured number of password verifications occur for the locked buckets, across two API instances, while a correct login still succeeds after a fresh window. |
| **OTP-AUTH-03 / High, conditional** | Attempt a money operation using an account created while `smsVerificationEnabled=false`, where `phoneVerifiedAt` is null. | Signup source creates an active user and wallet with no phone verification. Financial-route behavior has not been audited in this phase. | Isolated route test proves every financial action denies the unverified user server-side; test nominal behavior for a verified account. |
| **OTP-AUTH-04 / Medium** | Compare registration responses for a phone that already exists and one that does not, using a valid signup challenge or the disabled-SMS test policy. | Existing number returns `409` with an account-exists message; a new account returns `201`. This exposes account existence in the relevant flow. | After a generic response change, test both cases return indistinguishable status/body/timing within a defined tolerance without breaking successful registration. |
| **OTP-AUTH-05 / Medium** | Replay one verified challenge against signup, password reset, PIN reset, then replay the successful operation. | Source queries bind challenge to purpose, phone fingerprint, expiry, verified state and `consumedAt`; recovery/signup consume under row lock. No route-level replay test was found. | Tests prove wrong-purpose, expired, consumed, wrong-phone, and two concurrent consumers all fail; exactly one valid operation succeeds. |
| **OTP-AUTH-06 / Medium** | Send a state-changing auth request with a victim cookie and `Origin: https://attacker.example`; separately omit Origin. | `isTrustedOrigin` rejects both unlisted and absent origins on inspected mutation routes. CORS alone is not relied upon. This was not exercised over HTTP. | HTTP integration test proves `403`, no state change, and a same-origin nominal request still succeeds. |
| **OTP-AUTH-07 / Medium** | Attempt to forge a customer by sending another user's `userId` while presenting no valid session or a different session cookie. | Session helper derives user ID only from the hashed cookie lookup. Static source supports this; no route-level IDOR test exists. | HTTP tests prove forged IDs never alter the row/user scope and valid owner requests still work. |

Example request shape for isolated tests only (never use a real customer's
phone/password or the shared database):

```sh
curl -i "$BASE/api/auth/register" \
  -H "Origin: $ALLOWED_TEST_ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{
    "challengeId":"00000000-0000-4000-8000-000000000001",
    "phone":"+2250000000000",
    "fullName":"Test Customer",
    "birthDate":"1990-01-01",
    "password":"test",
    "acceptedPrivacy":true
  }'
```

This is an illustrative baseline payload, not a safe test against a shared or
production database: the expected pre-fix response can be `409` after the
expensive hash. Do not run it as a load test against Replit's shared service.

## Test baseline and confidence

Executed without real SMS or database writes:

- `pnpm --filter @workspace/api-server run test:auth` — **7 passed, 0 failed**.
  The customer-specific tests cover scrypt hashing/verification and random
  session-token shape/hash. The other tests in this command cover administrator
  PIN sessions.
- `pnpm --filter @workspace/api-server run test:otp` — **6 passed, 0 failed**.
  These test eSMS request construction, response parsing, sanitization, and
  provider rate-limit handling using a stub `fetch`.

No `tests/security/` suite or customer auth/OTP route test was found. These
results do **not** prove OTP challenge state transitions, DB concurrency,
cookie behavior over HTTP, Origin enforcement, session revocation, real eSMS
delivery, or financial-route authorization.

### Confidence labels

- **High confidence (static):** code/schema explicitly implement the controls
  described above or the identified ordering/validation gap.
- **Unproven behavior:** any claim requiring HTTP integration, PostgreSQL
  concurrency, actual reverse-proxy behavior, provider behavior, or downstream
  transaction authorization.
- **Not assessed:** wallet and transaction authorization, administrator
  authorization/abuse, Didit webhook attack testing, dependency CVEs, full CSP,
  global traffic-based rate-limit sizing, and deployment/environment isolation.

## Security guarantees required before remediation is considered complete

1. A customer account must never be created as phone-verified without a
   provider-approved OTP bound to that phone and the signup purpose.
2. SMS-disabled accounts must remain unable to perform any financial action
   until phone ownership is verified; this rule must be server-side.
3. OTP challenges must expire, have a bounded number of checks, bind to one
   phone and one purpose, and be consumed at most once under concurrent use.
4. Password, PIN, and OTP attempts must be rate-limited before expensive work,
   atomically across concurrent requests and API instances.
5. A customer identity must come only from a server-validated session; client
   user IDs, local storage, and UI lock flags must not grant access.
6. Credential recovery must consume its own purpose-bound OTP and revoke all
   existing customer sessions.
7. Session revocation, expiry and account suspension must take effect on the
   next protected API request.
8. Auth/OTP logs must not include plaintext passwords, PINs, OTP codes,
   session cookies, or unmasked phone numbers; audit records must capture
   enough trusted context for investigation without pretending user-agent or
   proxy-derived IP data is verified identity.
9. The test suite must include nominal and adversarial HTTP/database tests
   without sending paid SMS or mutating shared/production customer data.

## Scope boundary

This document completes the first requested modeling slice: customer OTP and
authentication. It does not certify wallet or transaction controls,
administrator authorization, Didit webhooks, dependency health, environment
isolation, or CSP. Those flows require their own threat models before their code
is changed. No application code or user-facing page was modified in this
phase.
