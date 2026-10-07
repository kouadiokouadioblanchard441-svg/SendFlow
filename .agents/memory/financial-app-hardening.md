---
name: Financial app hardening
description: Project-wide quality and security priorities for SendFlow.
---

Treat SendFlow as a financial application under active development. When hardening any page, prioritize security, protection and integrity of user data, correct server-side authorization, and safe behavior around financial actions.

**Why:** The user explicitly said SendFlow is a large financial application and security and data protection must remain central while strengthening its pages.

**How to apply:** For each page, identify sensitive data and money-moving actions, validate authorization and business rules on the server, prevent duplicate or partial operations, and test without modifying real accounts or the shared Neon database.

For paginated transaction history, keep timestamp comparisons in PostgreSQL and use a validated transaction ID as the cursor. Do not round-trip cursor timestamps through JavaScript `Date`.

**Why:** PostgreSQL timestamps can retain microseconds while JavaScript `Date` keeps milliseconds; rounding a cursor can silently omit or repeat financial records created within the same millisecond.

**How to apply:** Sort by `created_at` plus a deterministic ID tie-breaker, resolve the cursor timestamp in SQL under the authenticated user's ownership filter, and test malformed or foreign cursors without production data.
