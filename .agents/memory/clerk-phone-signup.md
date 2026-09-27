---
name: SendFlow customer authentication
description: User-approved design for customer phone OTP identity, server sessions, and separation from administrator login.
---

Customer accounts use eSMS Verify phone OTP for signup, password recovery, and PIN recovery. Challenges are bound to a declared purpose and consumed once. Customer identity comes from a server-validated opaque session in a `__Host-`, HttpOnly, Secure cookie; only a hash of the token is stored. Passwords and PINs use salted scrypt hashes. Clerk remains reserved for administrator authentication.

**Why:** The user selected phone + eSMS customer accounts and sessions while keeping Clerk for admins. Client-side identity state cannot authenticate protected API requests.

**How to apply:** Keep OTP/provider requests server-side and derive identity only from the validated session cookie. Never treat browser-supplied user IDs or local PIN state as authentication. Do not send real paid SMS during tests.