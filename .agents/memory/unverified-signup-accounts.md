---
name: Unverified customer accounts
description: Email verification never establishes ownership of a customer's phone number.
---

Email-only OTP verifies the account email, never the phone number. An account may be email-verified and still have an unverified phone; do not treat email verification, account creation, PIN setup, or sign-in as proof of phone ownership. Require a separate, purpose-bound phone verification before any financial operation that depends on phone ownership.

Do not tell customers that signup SMS verification is disabled or that their number is unverified. Keep this status internal to administration and enforce phone-ownership requirements on the server.

**Why:** The user chose email-only OTP verification. Email ownership and phone ownership are distinct security claims, especially in a financial product.

**How to apply:** Keep server-side phone-verification gates on financial operations that require phone ownership. Email OTP must update only email verification; do not silently promote the phone to verified.