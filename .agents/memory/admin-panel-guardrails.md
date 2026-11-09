---
name: SendFlow admin panel guardrails
description: Security and data-integrity decisions for the SendFlow back office.
---

SendFlow has exactly one Super Admin, authenticated by administrator email, password, and TOTP. Do not add public registration, invitations, extra administrator accounts, legacy grants, or PIN-based administrator access. All administrator API handlers fail closed and check the server-owned session; sensitive actions require a fresh, action-bound TOTP step-up and an audit record.

**Why:** The user explicitly replaced the former multi-grant/PIN model with one Super Admin and mandatory MFA. Customer PIN state and browser role claims are not administrator authorization.

**How to apply:** Bootstrap the singleton account through the controlled, non-public server procedure. Verify identity, password, TOTP, session, and step-up on the backend. Never trust roles or permissions sent by the client.

The admin interface is selected by a server-only allowlist of configured hostnames. Keep the private host value out of source, documentation, tests, logs, and frontend assets; read it only from deployment environment configuration. A visible API path is not an access control.

**Why:** The user requires the admin address to remain confidential and explicitly rejects obscurity as a replacement for authentication.

**How to apply:** Resolve allowed hosts from server environment configuration only. Treat Cloudflare Access, origin restrictions, and Plesk settings as unverified until configured and tested outside the repository.

The old browser paths `/admin` and `/admin/sign-in` are retired. The API may use a conventional `/api/admin` prefix because route obscurity is not part of the security boundary.

**Why:** The user asked to remove the previous panel route and move access to a separately configured domain, while requiring real backend authentication.

**How to apply:** Do not restore a browser path gate or opaque API prefix as authentication. Test that retired public browser paths return 404 and that every API handler still rejects unauthenticated requests.

Historical grant/session tables and migrations are retained for data and migration history; they are not active administrator authorization and must not be dropped as part of route cleanup.

**Why:** The user requires one active administrator model while preserving the existing financial database and its history.

**How to apply:** Never authorize from legacy grants or sessions. Keep cleanup additive and non-destructive; production database changes require explicit authorization and verification.

The user detail view uses server data, while transaction history is retrieved through a server-side user filter with bounded pagination. Wallet changes must be signed as immutable ledger entries with before/after balances, idempotency keys, expected-balance checks, a reason, and an audit record.

**Why:** Financial histories can grow without limit, and a client-only filter would risk exposing another user’s operations if the server did not constrain the query.

**How to apply:** Keep the user identifier in the authorization-protected API contract and apply it in the database query. Do not expose a raw balance overwrite; use a validated credit/debit adjustment through the ledger.

For an unchanged wallet operation, retries must reuse its original idempotency key and expected balance. The server must validate the expected balance on first use and verify that a duplicate key matches the user, administrator, direction, amount, and reason.

**Why:** A lost response after commit must not turn a retry into a second credit or debit, while a stale balance must not authorize a new financial operation.

**How to apply:** Keep the client key stable while the submitted wallet operation is unchanged. Generate a new key only when the user changes its payload, and never weaken server-side balance comparison to accommodate retries.

Account deletion and transaction deletion are logical state changes, not physical deletes: preserve wallets, ledger entries, transactions, and audit history.

**Why:** Financial evidence and account obligations must remain available after an operational record is removed from normal lists.

**How to apply:** Mark users deleted and transactions archived with the administrator, timestamp, and mandatory reason. Require explicit confirmation text for sensitive actions, and never use a customer PIN or an improvised administrator password.

The singleton Super Admin cannot be suspended or logically deleted through ordinary customer-management actions.

**Why:** The Super Admin credential is a separate singleton security identity, not an ordinary customer account.

**How to apply:** Change its identity, password, or MFA only through the controlled security procedure, with reauthentication and immediate session revocation.

Successful reads that expose user, transaction, session, or financial data—including overview, lists, and details—are fail-closed on audit persistence: if the server cannot append the access record, it must not return the data.

**Why:** A financial-data access that is visible to an administrator but absent from the audit trail cannot be reliably investigated later, whether it came from a detail page or a broad list.

**How to apply:** Append only the administrator identity, action, resource type, resource identifier, and timestamp; avoid IPs, query strings, idempotency secrets, and financial payloads in the audit record.

Admin API responses must not be cached, and unsafe browser requests must pass a same-origin or explicitly configured trusted-origin check; CORS alone is not CSRF protection.

**Why:** CORS can hide a response without preventing a form submission, and cached admin data can outlive the authorization context that produced it.

**How to apply:** Set private no-store headers for admin responses, validate origins on mutations, and allow origin-less requests only when they cannot rely on ambient browser cookies.

Public and administrator GET handlers must not seed or repair business data in response to a client request. Catalog bootstrap runs as a server-startup or migration step before traffic.

**Why:** A read request should not mutate financial configuration or let unauthenticated traffic trigger persistent initialization.

**How to apply:** Keep GET handlers query-only; perform baseline seeding in an explicit startup/migration path, and keep later catalog changes in audited administrator mutations.

Customer money-movement flows must remain blocked until a server-side operator integration confirms both any required OTP and the operation itself. An admin OTP policy is configuration only, not evidence of verification.

**Why:** A non-empty code or a client-side timer cannot prove authorization or payment settlement, and showing success could mislead users about money that was never moved.

**How to apply:** Keep unsupported operators clearly marked as not connected, fail closed in customer forms, and render success only from a verified server response.

The aggregator catalog and country/operator routes in the admin panel are configuration only. An enabled flag or route assignment cannot establish that a provider API is connected; adapter readiness is server-owned, and partner credentials stay in Replit Secrets rather than the admin panel or database.

**Why:** Routing metadata cannot authenticate a provider or prove settlement, and exposing credentials in an editable back office would widen the security boundary.

**How to apply:** Keep unimplemented providers marked as unavailable for transactions. Only server-side adapter code that verifies real provider results may enable money movement, with credentials read from Replit Secrets.

The operator-pricing bootstrap is a one-time baseline, not a continuing sync from the aggregator catalog. Operators added after that baseline must be created through the audited admin flow and start disabled with no assumed rates.

**Why:** A code-only catalog addition must not silently publish a new operator or assign it an invented fee.

**How to apply:** Seed only an empty operator catalog. Require explicit administrative creation, activation, and rate configuration for later operators.

The admin console must use real icon components or approved image assets for financial states, operators, security markers, and navigation; do not draw iconography with CSS dots, initials, or pseudo-elements.

**Why:** Financial operations need recognizable, consistent symbols on mobile and desktop, and an operator logo must never be faked with another partner’s branding.

**How to apply:** Prefer Lucide icons for generic concepts, use only approved operator assets when available, and use a clearly generic icon for operators without an approved logo.

All administrator catalog, customer, and financial APIs require the Super Admin session. Sensitive mutations require a recent, one-time, action-bound TOTP step-up; never reuse the customer PIN flow.

**Why:** The user requires one mandatory MFA-protected administrator identity, independent from customer authentication.

**How to apply:** Keep authentication and authorization server-side. Never infer admin rights from customer sessions, customer PIN state, UI visibility, or client-supplied roles.

Administrative transaction reads must be allowed by both the route-specific read guard and the central admin-handler middleware; changing only one layer still leaves the endpoint denied.

**Why:** The admin router has defense-in-depth checks at the mount and route levels, so an otherwise correct handler-level permission change can be unreachable behind the global allowlist.

**How to apply:** When adding an admin endpoint, update and test the central and route-specific checks, preserve the Super Admin session requirement, and require step-up for sensitive mutations.

Customer-account blocking and unblocking require the authenticated Super Admin session and a fresh TOTP step-up. Only the explicit suspend/restore actions are in scope; this does not authorize account deletion.

**Why:** The user requires one administrator identity and mandatory reauthentication for sensitive account actions.

**How to apply:** Enforce each action on the server, audit its reason, revoke customer sessions when blocking, and keep deletion separately controlled.

The login-activity view must derive its identity and session data from the server-validated SendFlow session, not client-supplied account identifiers. It stores server-observed network and device metadata, but leaves location blank until a proxy contract is verified.

**Why:** IP geolocation is personal-data processing, and client-supplied headers can be forged unless a trusted proxy strips or overwrites them. A guessed city is worse than an honest unknown.

**How to apply:** Do not accept inbound geolocation headers by default. Enable an approved server-side provider only after proxy trust, privacy, retention, and error behavior are defined.

Do not add prefilled templates or canned campaign copy to the email-campaign interface until the user supplies approved templates for harmonization.

**Why:** The user explicitly said they will provide the campaign email templates later and wants the current work limited to the interface.

**How to apply:** Keep the campaign composer content blank and user-authored; do not invent branded email text or layouts.