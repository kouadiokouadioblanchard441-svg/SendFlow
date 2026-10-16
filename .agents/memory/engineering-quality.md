---
name: SendFlow engineering quality
description: SendFlow is a large financial application; this records the user's standing code-quality expectation.
---

SendFlow is a large financial application under active development. Do not take shortcuts merely to move faster; its code must be solid and robust.

For the current transfer and financial-security work, do not modify any application pages. Keep changes in the server, API contracts, shared non-page logic, schema/migrations, and tests unless the user explicitly changes this constraint.

**Why:** The user emphasized that SendFlow is a large financial application and expects solid, robust code.

**How to apply:** Prefer robust solutions over shortcuts taken only to save time, and keep customer UI pages untouched during the current server-side financial work.

Do not move to dependent feature work until the relevant financial logic is checked beyond compilation and the happy path: validate business invariants, invalid and failure paths, concurrency, idempotency, persistence, and recovery with isolated tests. If a guarantee depends on live infrastructure or data that cannot be tested safely, report it as unverified instead of claiming completion.

**Why:** The user explicitly requires SendFlow's logic to be solid and correctly applied before development continues.

**How to apply:** For each financial or security change, define the invariant and its trust boundary, exercise failure and concurrent cases without touching shared Neon or real services, and list any infrastructure-dependent checks that remain blocked before starting dependent work.
