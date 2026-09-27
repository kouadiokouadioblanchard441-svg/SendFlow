---
name: SendFlow signup authentication
description: SendFlow's phone/PIN screens are local-only; the production identity provider and server-session bridge are not yet connected.
---

The user wants to retain the phone/PIN experience and plans to integrate a compatible OTP service themselves. The exact provider and how its verified identity will authorize API sessions remain unresolved. Do not add Twilio or replace Clerk without an explicit request.

**Why:** The configured Replit-managed Clerk does not support phone/SMS sign-in, while the current SendFlow forms and PIN store only browser-local state and do not create an authenticated server session.

**How to apply:** Keep protected APIs fail-closed until a real server-verifiable session is established. Treat client-side PIN/OTP state as UI state only; confirm provider/session ownership before changing the login architecture.