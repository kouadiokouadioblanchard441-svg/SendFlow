---
name: SendFlow authentication
description: Customer authentication and the planned SendFlow-owned administrator boundary.
---

Customer and administrator authentication must remain SendFlow-owned, with server-verified eSMS OTP and database authorization. No administrator account may be seeded or promoted automatically; provisioning requires explicit authorization.

**Why:** The user explicitly chose to remove external identity services and keep authentication, authorization, and sessions within SendFlow's server and database.

**How to apply:** Keep OTP/provider requests server-side and derive identity only from the validated session cookie. Never treat browser-supplied user IDs or local PIN state as authentication. Catalogue administrator access does not authorize unrelated administration. Do not send real paid SMS during tests.

For the shared customer login/signup lockout, successful signup OTP verification alone does not clear failed attempts; only a successful login or completed account creation does.

**Why:** OTP verification is an intermediate signup step, not proof that the full authentication flow succeeded. Clearing the counter there would let repeated signup attempts erase the shared lockout.

**How to apply:** Keep failure-counter resets at completed login or account creation, not at OTP approval.

After a successful password recovery, clear only the phone-scoped shared access and legacy login-phone buckets. Acquire those same attempt locks first, and clear them in the transaction that consumes the OTP, changes the password, and revokes sessions; keep the requester-wide bucket.

**Why:** Clearing after commit can race with sign-in failures or report recovery failure after the password has already changed.

**How to apply:** Keep password recovery ordered like other customer-access operations: attempt-bucket locks before challenge/user rows, with the reset and counter clear committed atomically.

Biometric PIN unlock must use a server-verified WebAuthn assertion, a one-use session-bound challenge, and credentials scoped to the current relying-party ID. Device capability or a client-side biometric success flag is never proof of authentication. Keep the PIN as fallback and expose shared-Neon preview routes only through the exact preview-account session gate.

**Why:** The user chose biometric unlock in browser and installed app only where supported; shared Neon is also used by production, and credentials from one app origin must not unlock another.

**How to apply:** Keep origin/RP checks on the server, retain the existing PIN attempt controls, and require a PIN-unlocked session to register or revoke credentials. Do not add native biometric plugins or platform configuration without the separate mobile phase approval.

Offer biometric enrollment as a question only after a successful PIN unlock; do not require a separate activation page. If the user chooses “Plus tard,” offer again after the next successful PIN unlock until the server confirms enrollment. Unsupported devices and status-check failures must never block PIN access. Keep account controls for status and revocation.

**Why:** The user chose a repeatable post-PIN offer until activation, with the PIN remaining available.

**How to apply:** Check server enrollment status after PIN success, ask before starting WebAuthn registration, and continue into the account when the user defers, cancels, or an error occurs.
