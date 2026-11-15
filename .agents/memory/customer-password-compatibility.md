---
name: Customer password compatibility
description: Maintain the stronger password rule without locking out existing SendFlow customers.
---

New registrations and password resets require at least eight characters. Sign-in must continue accepting existing four-character passwords until there is a safe customer upgrade or recovery path.

Password recovery is email-only and must use the verified address already associated with the account. The separate PIN-reset flow remains phone-based unless explicitly changed.

Customer and administrator passwords must be stored as Argon2id hashes. Existing customer scrypt password hashes cannot be converted without the plaintext password, so retain verification only for those legacy hashes and rehash them to Argon2id after a successful sign-in. New registration, password reset, and preview-account provisioning must write Argon2id hashes. Customer PIN hashes are a separate credential and remain on their existing scrypt path unless the user changes that policy.

**Why:** Raising the sign-in minimum immediately would lock out existing customers who still use shorter passwords. Keeping password and PIN recovery identities separate prevents a password-recovery request from changing another authentication flow.

**Why:** Password hashes are one-way; migrating historical scrypt hashes requires the user's next successful plaintext sign-in or password reset. PINs use a distinct verification flow and must not be changed as a side effect of password hardening.

**How to apply:** Keep registration and password-reset validation aligned across the API, OpenAPI, and frontend. Bind password-recovery OTPs to the verified email; keep PIN reset phone-bound. Do not raise the sign-in minimum without a migration or user-facing upgrade path. Apply Argon2id only to passwords, safely upgrade verified legacy customer hashes at sign-in, and preserve preview-database scoping when writing upgraded hashes.
