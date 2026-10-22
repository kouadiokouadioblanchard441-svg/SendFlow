---
name: Authentication test isolation
description: Isolate security-test client identities and runtime modes without weakening production protections.
---

Authentication test cases must isolate the complete rate-limit identity, including the client IP, rather than only using different phone numbers.

**Why:** Failed signup attempts can consume the shared IP quota and make a later unrelated authentication test return 429, hiding the behavior it intends to measure.

**How to apply:** Use distinct synthetic client identities behind a deliberately configured fixture proxy. Keep rate limiting active and production configuration unchanged; isolate test state instead of weakening protections.

Treat the runtime mode as an explicit test input rather than inheriting the workspace's shared-database preview mode.

**Why:** Preview session isolation intentionally changes the session-hash realm. A unit assertion for ordinary sessions can fail merely because it inherited preview settings, without indicating broken cryptography.

**How to apply:** Exercise ordinary and preview contracts separately with synthetic configuration. Never remove preview isolation or change persistent environment settings just to satisfy an ordinary-mode assertion.
