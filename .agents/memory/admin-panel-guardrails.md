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

Successful sensitive detail reads are fail-closed on audit persistence: if the server cannot append the administrator/resource access record, it must not return the user or transaction detail.

**Why:** A financial-data access that is visible to an administrator but absent from the audit trail cannot be reliably investigated later.

**How to apply:** Append only the administrator identity, action, resource type, resource identifier, and timestamp; avoid IPs, query strings, idempotency secrets, and financial payloads in the audit record.

The admin console must use real icon components or approved image assets for financial states, operators, security markers, and navigation; do not draw iconography with CSS dots, initials, or pseudo-elements.

**Why:** Financial operations need recognizable, consistent symbols on mobile and desktop, and an operator logo must never be faked with another partner’s branding.

**How to apply:** Prefer Lucide icons for generic concepts, use only approved operator assets when available, and use a clearly generic icon for operators without an approved logo.

The login-activity view records one event per Clerk session when the authenticated account endpoint is called. It stores the server-observed IP, user-agent-derived device/browser/OS, and city only when supplied by a trusted proxy header; missing location stays explicit.

**Why:** IP geolocation is personal-data processing and proxy infrastructure may not provide a reliable city. A guessed city is worse than an honest unknown.

**How to apply:** Keep location source visible in the data model, do not invent a city, and use an approved server-side geolocation provider only after privacy, retention, and error behavior are defined.