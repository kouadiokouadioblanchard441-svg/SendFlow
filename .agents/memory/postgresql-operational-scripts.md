---
name: PostgreSQL operational script safety
description: Non-obvious psql exit behavior and EXECUTE semantics for existing trigger guards.
---

Use an SQL exception with `ON_ERROR_STOP` for a failing psql script guard, not `\quit 3`.

**Why:** psql 16.15 ignores the numeric argument to `\quit` and exits successfully, which can make an unapproved operation look successful to automation.

**How to apply:** Make missing/invalid approval parameters produce a tested nonzero process exit before any persistent change.

Revoking direct EXECUTE on a SECURITY DEFINER trigger function does not stop its already installed trigger from firing.

**Why:** PostgreSQL checks EXECUTE at trigger creation, not on each invocation. Keeping direct application EXECUTE solely to preserve an existing guard grants unnecessary access.

**How to apply:** Review elevated routines individually, preserve trigger ownership/body/activation, and verify the guard still rejects invalid writes after any privilege change on an isolated database.
