---
name: eSMS Verify balance requirement
description: Test-prefixed eSMS credentials do not guarantee free verification sends.
---

A test-prefixed `ESMS_API_KEY` does not imply free Verify sends; the provider can reject `/verify/start` with HTTP 402 for insufficient balance.

**Why:** A live request reached eSMS and returned an explicit insufficient-balance response rather than a network or local configuration error.

**How to apply:** Check Verify entitlement and available credit before real OTP tests. After a 402, do not retry until the account balance changes; keep provider diagnostics server-side and sanitized.