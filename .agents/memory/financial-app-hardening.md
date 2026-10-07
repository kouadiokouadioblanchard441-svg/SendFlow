---
name: Financial app hardening
description: Project-wide quality and security priorities for SendFlow.
---

The server is the only authority for SendFlow. Never rely on a client-side check or a database value alone to authorize access or an operation; validate identities, ownership, state, and business rules on the server. Keep sensitive values out of source and client bundles, and read secrets only in server code from Replit Secrets.

**Why:** The user explicitly requires every sensitive decision to be checked by the server, does not want the client or database treated as authorization, and requires sensitive information to remain server-side and out of code.

**How to apply:** Treat client claims, browser state, and persisted values as inputs to verify. The server must check Clerk identity, allowlists, PIN sessions, resource ownership, schemas, and financial invariants before returning or changing data. Fail closed on validation or storage errors, prevent duplicate or partial operations, and test without modifying real accounts or the shared Neon database.

For paginated transaction history, keep timestamp comparisons in PostgreSQL and use a validated transaction ID as the cursor. Do not round-trip cursor timestamps through JavaScript `Date`.

**Why:** PostgreSQL timestamps can retain microseconds while JavaScript `Date` keeps milliseconds; rounding a cursor can silently omit or repeat financial records created within the same millisecond.

**How to apply:** Sort by `created_at` plus a deterministic ID tie-breaker, resolve the cursor timestamp in SQL under the authenticated user's ownership filter, and test malformed or foreign cursors without production data.
