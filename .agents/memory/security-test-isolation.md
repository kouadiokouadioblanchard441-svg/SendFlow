---
name: Authentication test isolation
description: Isolate every rate-limit identity in security fixtures, not only the account or phone.
---

Authentication test cases must isolate the complete rate-limit identity, including the client IP, rather than only using different phone numbers.

**Why:** Failed signup attempts can consume the shared IP quota and make a later unrelated authentication test return 429, hiding the behavior it intends to measure.

**How to apply:** Use distinct synthetic client identities behind a deliberately configured fixture proxy. Keep rate limiting active and production configuration unchanged; isolate test state instead of weakening protections.
