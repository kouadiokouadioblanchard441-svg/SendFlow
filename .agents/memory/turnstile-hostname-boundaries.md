---
name: Turnstile hostname boundaries
description: Distinguishes local Replit preview failures from production Turnstile configuration.
---

Cloudflare Turnstile authorizes hostnames separately. A local Replit preview can show widget error `110200` when its hostname is not allowed, even while the Plesk production hostname is configured correctly.

**Why:** The browser preview uses a different hostname from `merchant.business.sendflow.africa`; a preview widget error does not prove production is misconfigured, and hiding it by disabling server verification would weaken account security.

**How to apply:** Check the hostname allowlist for the environment being tested. Keep server-side Siteverify and fail-closed behavior enabled; use mocked Siteverify responses in isolated automated tests.
