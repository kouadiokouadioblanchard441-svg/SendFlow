---
name: Didit credentials and runtime separation
description: User-confirmed live credentials, secret handling, and financial safeguards independent of preview labels.
---

The user confirmed that the supplied Didit credentials are live/production and repeatedly asked to stop describing them as development or sandbox keys. Keep all provider credentials server-side in the secret manager; never read, print, log, or persist their values in source files. Do not repeatedly request replacement sandbox credentials.

**Why:** The user explicitly corrected the credential classification and requires rigorous organization and financial logic with no secret values in code.

**How to apply:** Distinguish the provider's actual live mode from the Replit runtime scope. Declare provider mode truthfully, preserve runtime and shared-database protections, and report blocked functionality rather than weakening guards or forcing production runtime in a preview. Configuring live credentials alone does not authorize real provider calls, paid SMS, financial mutations, or migrations. Verify configuration with isolated checks that inherit no real credentials.

Didit's session webhook envelope includes an environment (`sandbox` or `live`) and separates `status.updated` from `data.updated`; both event families can carry a `status` field, but only `status.updated` may change SendFlow's KYC state.

**Why:** A status field alone does not establish that an event represents a verification status transition.

**How to apply:** After signature and freshness checks, require an exact environment match and allow only `status.updated` into KYC schema validation and database processing. Acknowledge other signed event types without changing state.

An `Approved` verification remains valid for account limits until an explicit revocation flow exists. Reuse that record rather than creating a new session; unfinished states, including `In Review`, should also be reused.

**Why:** The customer flow only offers a retry after a failed verification and has no re-verification or revocation path. Starting another session after approval could replace the latest status and lower the customer's limit.

**How to apply:** Prefer an existing approved record when returning identity status or account limits, and include all unfinished provider states in the session-reuse check. Revisit this only alongside an explicit, audited revocation or renewal feature.