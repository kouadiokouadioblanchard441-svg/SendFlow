---
name: Customer password compatibility
description: Maintain the stronger password rule without locking out existing SendFlow customers.
---

New registrations and password resets require at least eight characters. Sign-in must continue accepting existing four-character passwords until there is a safe customer upgrade or recovery path.

**Why:** Raising the sign-in minimum immediately would lock out existing customers who still use shorter passwords.

**How to apply:** Keep registration and reset validation aligned across the API, OpenAPI, and frontend. Do not raise the sign-in minimum without a migration or user-facing upgrade path.
