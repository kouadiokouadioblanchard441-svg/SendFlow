---
name: Didit development integration
description: Constraints for keeping identity verification in development until Didit sandbox configuration is available.
---

The Didit integration must remain server-side and development-only until the sandbox API key, webhook secret, and published workflow ID are configured through Replit environment management. Webhook acceptance also requires the documented five-minute timestamp window.

**Why:** The user explicitly requires full development and sandbox testing before any public release or real money operation, and the secure credential request was declined.

**How to apply:** Keep missing credentials as an explicit configuration error, reject unsigned webhooks, and do not substitute fake provider credentials or live verification calls.