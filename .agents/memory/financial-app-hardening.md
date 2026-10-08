---
name: Financial app hardening
description: Project-wide quality and security priorities for SendFlow.
---

The server is the only authority for SendFlow. The frontend is untrusted and must never be the security authority. Never hardcode or store secret keys, tokens, credentials, or sensitive personal or financial values in frontend or backend source or client bundles. Load required secrets only into the server runtime from Replit Secrets. Verify identities, ownership, state, and business rules on the server before accessing or changing data.

**Why:** The user explicitly requires no keys or sensitive information in frontend or backend code, and requires sensitive checks to be performed on their server.

**How to apply:** Treat client claims, browser state, and persisted values as untrusted inputs. Keep credentials in Replit Secrets and access them only from server code; do not expose their values to the frontend. The server must check Clerk identity, allowlists, PIN sessions, resource ownership, schemas, and financial invariants before returning or changing data. Fail closed on validation or storage errors, prevent duplicate or partial operations, and test without modifying real accounts or the shared Neon database.

For paginated transaction history, keep timestamp comparisons in PostgreSQL and use a validated transaction ID as the cursor. Do not round-trip cursor timestamps through JavaScript `Date`.

**Why:** PostgreSQL timestamps can retain microseconds while JavaScript `Date` keeps milliseconds; rounding a cursor can silently omit or repeat financial records created within the same millisecond.

**How to apply:** Sort by `created_at` plus a deterministic ID tie-breaker, resolve the cursor timestamp in SQL under the authenticated user's ownership filter, and test malformed or foreign cursors without production data.
