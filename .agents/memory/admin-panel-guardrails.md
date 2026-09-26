---
name: SendFlow admin panel guardrails
description: Security and data-integrity decisions for the SendFlow back office.
---

The SendFlow back office is deny-by-default: reads use the read-admin allowlist, while sensitive mutations require a separate server-side mutation allowlist, an audit record, and real database-backed state. Never use a client-only route check or demo financial values.

**Why:** SendFlow handles financial data, and the existing customer PIN/session flag is not an authorization boundary. Read access and write access must be independently revocable.

**How to apply:** Keep admin API routes deny-by-default and enforce authorization on the server. Use a separate mutation administrator allowlist for financial/account actions. Add new metrics only when their source exists in the database and label unsupported operations explicitly instead of inventing them.

The user detail view uses server data, while transaction history is retrieved through a server-side user filter with bounded pagination. Wallet changes must be signed as immutable ledger entries with before/after balances, idempotency keys, expected-balance checks, a reason, and an audit record.

**Why:** Financial histories can grow without limit, and a client-only filter would risk exposing another user’s operations if the server did not constrain the query.

**How to apply:** Keep the user identifier in the authorization-protected API contract and apply it in the database query. Do not expose a raw balance overwrite; use a validated credit/debit adjustment through the ledger.

For an unchanged wallet operation, retries must reuse its original idempotency key and expected balance. The server must validate the expected balance on first use and verify that a duplicate key matches the user, administrator, direction, amount, and reason.

**Why:** A lost response after commit must not turn a retry into a second credit or debit, while a stale balance must not authorize a new financial operation.

**How to apply:** Keep the client key stable while the submitted wallet operation is unchanged. Generate a new key only when the user changes its payload, and never weaken server-side balance comparison to accommodate retries.

Account deletion and transaction deletion are logical state changes, not physical deletes: preserve wallets, ledger entries, transactions, and audit history.

**Why:** Financial evidence and account obligations must remain available after an operational record is removed from normal lists.

**How to apply:** Mark users deleted and transactions archived with the administrator, timestamp, and mandatory reason. Require explicit confirmation text for sensitive actions, and never use a customer PIN or an improvised administrator password.

Configured administrator accounts cannot be suspended or logically deleted through ordinary user-management actions.

**Why:** The administrator allowlists are configuration-backed, so changing a user row does not reliably revoke access and could leave a privileged account in a confusing partial state.

**How to apply:** Check both read and mutation administrator allowlists before allowing account suspension or deletion. Change administrator access through the dedicated access configuration process instead.

Successful reads that expose user, transaction, session, or financial data—including overview, lists, and details—are fail-closed on audit persistence: if the server cannot append the access record, it must not return the data.

**Why:** A financial-data access that is visible to an administrator but absent from the audit trail cannot be reliably investigated later, whether it came from a detail page or a broad list.

**How to apply:** Append only the administrator identity, action, resource type, resource identifier, and timestamp; avoid IPs, query strings, idempotency secrets, and financial payloads in the audit record.

Admin API responses must not be cached, and unsafe browser requests must pass a same-origin or explicitly configured trusted-origin check; CORS alone is not CSRF protection.

**Why:** CORS can hide a response without preventing a form submission, and cached admin data can outlive the authorization context that produced it.

**How to apply:** Set private no-store headers for admin responses, validate origins on mutations, and allow origin-less requests only when they cannot rely on ambient browser cookies.

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

The login-activity view records one event per Clerk session when the authenticated account endpoint is called. It stores the server-observed IP and user-agent-derived device/browser/OS, but leaves location blank until a proxy contract is verified.

**Why:** IP geolocation is personal-data processing, and client-supplied headers can be forged unless a trusted proxy strips or overwrites them. A guessed city is worse than an honest unknown.

**How to apply:** Do not accept inbound geolocation headers by default. Enable an approved server-side provider only after proxy trust, privacy, retention, and error behavior are defined.