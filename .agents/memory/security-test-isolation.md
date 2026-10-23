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

Security tests must identify the rejecting layer rather than treating any
denial as proof of the intended control.

**Why:** Network defenses, origin checks, authentication and parsers can all
reject the same request before a later control runs. An unrelated early denial
can hide a missing check or make a correct later check appear broken.

**How to apply:** Supply valid prerequisites when exercising a later boundary;
test missing prerequisites separately. Verify both the expected refusal and a
legitimate allowed path, and check side effects when non-execution is the claim.
