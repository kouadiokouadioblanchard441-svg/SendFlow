---
name: Didit development integration
description: Constraints for keeping identity verification in development until Didit sandbox configuration is available.
---

The Didit integration must remain server-side. `DIDIT_API_KEY` and `DIDIT_WEBHOOK_SECRET` were supplied through Replit's secret flow; never read, print, or log their values. Session creation also requires a published workflow ID and a `DIDIT_ENVIRONMENT` that matches `NODE_ENV`. The user requires full sandbox testing before public release or real-money operation.

**Why:** The user explicitly requires full development and sandbox testing before any public release or real-money operation. The prior note that the credential request was declined is stale.

**How to apply:** Keep credentials server-only, verify workflow/environment configuration through the environment tooling before a provider test, reject unsigned webhooks, and do not substitute fake credentials or make live verification calls.

Didit's session webhook envelope includes an environment (`sandbox` or `live`) and separates `status.updated` from `data.updated`; both event families can carry a `status` field, but only `status.updated` may change SendFlow's KYC state.

**Why:** A status field alone does not establish that an event represents a verification status transition.

**How to apply:** After signature and freshness checks, require an exact environment match and allow only `status.updated` into KYC schema validation and database processing. Acknowledge other signed event types without changing state.

An `Approved` verification remains valid for account limits until an explicit revocation flow exists. Reuse that record rather than creating a new session; unfinished states, including `In Review`, should also be reused.

**Why:** The customer flow only offers a retry after a failed verification and has no re-verification or revocation path. Starting another session after approval could replace the latest status and lower the customer's limit.

**How to apply:** Prefer an existing approved record when returning identity status or account limits, and include all unfinished provider states in the session-reuse check. Revisit this only alongside an explicit, audited revocation or renewal feature.