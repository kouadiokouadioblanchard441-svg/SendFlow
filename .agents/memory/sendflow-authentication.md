---
name: SendFlow authentication
description: Customer authentication and the planned SendFlow-owned administrator boundary.
---

Customer accounts use eSMS Verify phone OTP for signup, password recovery, and PIN recovery. Challenges are bound to a declared purpose and consumed once. Customer identity comes from a server-validated opaque session in a `__Host-`, HttpOnly, Secure cookie; only a hash of the token is stored. Passwords and PINs use salted scrypt hashes. Administrator access is currently fail-closed; the intended replacement is SendFlow phone OTP plus a database role, with no account seeded until the user provisions it.

**Why:** The user explicitly chose to remove external identity services and keep authentication, authorization, and sessions within SendFlow's server and database.

**How to apply:** Keep OTP/provider requests server-side and derive identity only from the validated session cookie. Never treat browser-supplied user IDs or local PIN state as authentication. Do not enable admin routes until database role checks and the SendFlow OTP login are implemented. Do not send real paid SMS during tests.

For the shared customer login/signup lockout, successful signup OTP verification alone does not clear failed attempts; only a successful login or completed account creation does.

**Why:** OTP verification is an intermediate signup step, not proof that the full authentication flow succeeded. Clearing the counter there would let repeated signup attempts erase the shared lockout.

**How to apply:** Keep failure-counter resets at completed login or account creation, not at OTP approval.

After a successful password recovery, clear only the phone-scoped shared access and legacy login-phone buckets. Acquire those same attempt locks first, and clear them in the transaction that consumes the OTP, changes the password, and revokes sessions; keep the requester-wide bucket.

**Why:** Clearing after commit can race with sign-in failures or report recovery failure after the password has already changed.

**How to apply:** Keep password recovery ordered like other customer-access operations: attempt-bucket locks before challenge/user rows, with the reset and counter clear committed atomically.
