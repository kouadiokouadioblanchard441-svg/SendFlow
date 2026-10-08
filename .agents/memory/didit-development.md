---
name: Didit development integration
description: Constraints for keeping identity verification in development until Didit sandbox configuration is available.
---

The Didit integration must remain server-side. `DIDIT_API_KEY` and `DIDIT_WEBHOOK_SECRET` were supplied through Replit's secret flow; never read, print, or log their values. Session creation also requires a published workflow ID and a `DIDIT_ENVIRONMENT` that matches `NODE_ENV`. The user requires full sandbox testing before public release or real-money operation.

**Why:** The user explicitly requires full development and sandbox testing before any public release or real-money operation. The prior note that the credential request was declined is stale.

**How to apply:** Keep credentials server-only, verify workflow/environment configuration through the environment tooling before a provider test, reject unsigned webhooks, and do not substitute fake credentials or make live verification calls.