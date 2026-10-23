---
name: Financial app hardening
description: Project-wide quality and security priorities for SendFlow.
---

Use the user's nine installed cybersecurity skills for cybersecurity work on SendFlow.

**Why:** The user explicitly asked that these skills be used as cybersecurity competencies for the project.

**How to apply:** Consult the relevant installed skills for the requested work. Distinguish guidance applied from tests actually executed, and disclose when a test requires the unavailable Strix engine.

Do not treat a missing Strix executable as proof that Strix cannot be used. Check
its official open-source installation path and the Docker/model prerequisites.

**Why:** The user explicitly pointed out that the public Strix CLI can be
installed and expects the installed security skills to be actively used.

**How to apply:** Prefer the local OSS CLI when feasible. Verify downloaded
release integrity, use a disposable copy of the uncommitted repository because
the scan target is writable, do not use Strix Cloud credits unless the user
authorizes them, and clearly identify any missing model provider credentials.

The server is the only authority for SendFlow. The frontend is untrusted and must never be the security authority. Never hardcode or store secret keys, tokens, credentials, or sensitive personal or financial values in frontend or backend source or client bundles. Load required secrets only into the server runtime from Replit Secrets. Verify identities, ownership, state, and business rules on the server before accessing or changing data.

**Why:** The user explicitly requires no keys or sensitive information in frontend or backend code, and requires sensitive checks to be performed on their server.

**How to apply:** Treat client claims, browser state, and persisted values as untrusted inputs. Keep credentials in Replit Secrets and access them only from server code; do not expose their values to the frontend. The server must check SendFlow sessions, database roles, PIN sessions, resource ownership, schemas, and financial invariants before returning or changing data. Fail closed on validation or storage errors, prevent duplicate or partial operations, and test without modifying real accounts or the shared Neon database.

Financial amount and balance invariants must also be enforced by database `CHECK` constraints; route validation alone does not protect alternate or future write paths. When historical rows cannot be reviewed, prepare additive `NOT VALID` constraints to protect new writes, then validate existing data separately after an authorized review.

**Why:** Direct SQL and future code paths can bypass application validation, while the shared Neon database must not be inspected or changed without authorization.

**How to apply:** Keep matching checks in the Drizzle schema and a targeted additive migration. Never execute that migration against shared Neon during tests or previews; review historical values and obtain authorization before applying or validating it.

Treat existing versioned SQL migrations as immutable: add a new migration for schema changes rather than editing an earlier file that may already have been applied.

**Why:** Rewriting an idempotent migration does not update databases where its original definition already ran, leaving runtime code and deployed schema out of sync.

**How to apply:** Preserve existing migration contents, name follow-up migrations clearly, and state their prerequisites. Test them only against a disposable isolated PostgreSQL database before considering deployment.

For paginated transaction history, keep timestamp comparisons in PostgreSQL and use a validated transaction ID as the cursor. Do not round-trip cursor timestamps through JavaScript `Date`.

**Why:** PostgreSQL timestamps can retain microseconds while JavaScript `Date` keeps milliseconds; rounding a cursor can silently omit or repeat financial records created within the same millisecond.

**How to apply:** Sort by `created_at` plus a deterministic ID tie-breaker, resolve the cursor timestamp in SQL under the authenticated user's ownership filter, and test malformed or foreign cursors without production data.
