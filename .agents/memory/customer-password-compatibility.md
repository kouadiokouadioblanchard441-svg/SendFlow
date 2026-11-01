---
name: Customer password compatibility
description: Maintain the stronger password rule without locking out existing SendFlow customers.
---

New registrations and password resets require at least eight characters. Sign-in must continue accepting existing four-character passwords until there is a safe customer upgrade or recovery path.

Password recovery is email-only and must use the verified address already associated with the account. The separate PIN-reset flow remains phone-based unless explicitly changed.

**Why:** Raising the sign-in minimum immediately would lock out existing customers who still use shorter passwords. Keeping password and PIN recovery identities separate prevents a password-recovery request from changing another authentication flow.

**How to apply:** Keep registration and password-reset validation aligned across the API, OpenAPI, and frontend. Bind password-recovery OTPs to the verified email; keep PIN reset phone-bound. Do not raise the sign-in minimum without a migration or user-facing upgrade path.
