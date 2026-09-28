---
name: Unverified customer accounts
description: Security boundary for customer accounts created while signup SMS verification is disabled.
---

Accounts created while the administrator disables signup SMS are allowed to browse the app, but their phone number is not trusted. Re-enabling signup SMS does not retroactively verify those accounts. Require a fresh, purpose-bound OTP before introducing any financial operation that depends on phone ownership, and provide a way for these customers to verify later.

**Why:** The user requested an admin-controlled bypass to create a viewing account despite the SMS provider's balance issue. Treating the bypass as permanent proof of phone ownership would make a temporary testing setting a financial security vulnerability.

**How to apply:** Keep financial capabilities blocked for unverified numbers when connecting actual payment providers. Do not infer ownership from account creation, PIN setup, a previous sign-in, or later changes to the signup policy.