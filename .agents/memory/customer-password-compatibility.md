---
name: Customer password compatibility
description: Maintain the stronger password rule without locking out existing SendFlow customers.
---

New registrations and password resets require at least eight characters. Sign-in must continue accepting existing four-character passwords until there is a safe customer upgrade or recovery path.

Password recovery is email-only and must use the verified address already associated with the account. The separate PIN-reset flow remains phone-based unless explicitly changed.

Customer and administrator passwords, and customer transaction PINs, must be stored as Argon2id hashes. Existing customer scrypt password and PIN hashes cannot be converted without the original secret, so retain verification for legacy values and upgrade a password after successful sign-in or a PIN after successful verification. New registration, password reset, PIN set/reset, and preview-account provisioning must write Argon2id hashes.

**Why:** Raising the sign-in minimum immediately would lock out existing customers who still use shorter passwords. Keeping password and PIN recovery identities separate prevents a password-recovery request from changing another authentication flow.

**Why:** Password and PIN hashes are one-way; historical scrypt values require the user's next successful authentication or reset. PIN verification is a separate, low-entropy flow and must retain strict account/requester rate limits and cross-instance locking.

**How to apply:** Keep registration and password-reset validation aligned across the API, OpenAPI, and frontend. Bind password-recovery OTPs to the verified email; keep PIN reset phone-bound. Do not raise the sign-in minimum without a migration or user-facing upgrade path. Use Argon2id for new passwords and PINs, safely upgrade legacy hashes only after successful verification, and preserve preview-database scoping when writing upgraded hashes.
