---
name: SendFlow engineering quality
description: SendFlow is a large financial application; this records the user's standing code-quality expectation.
---

SendFlow is a large financial application under active development. Do not take shortcuts merely to move faster; its code must be solid and robust.

For transfer and financial-security work, preserve application pages' appearance, structure, text, fields, buttons and fee locations. The user explicitly permits changing only their API wiring to remove local financial calculations and display the server's real fees and totals.

**Why:** The user emphasized that SendFlow is a large financial application and expects solid, robust code. They explicitly require real server-provided fees without changing anything about the pages' appearance.

**How to apply:** Prefer robust solutions over shortcuts taken only to save time. API binding expressions and hooks may change; do not redesign or otherwise change the pages. Display unavailable server amounts as unavailable rather than calculating a fallback in the browser.

Do not move to dependent feature work until the relevant financial logic is checked beyond compilation and the happy path: validate business invariants, invalid and failure paths, concurrency, idempotency, persistence, and recovery with isolated tests. If a guarantee depends on live infrastructure or data that cannot be tested safely, report it as unverified instead of claiming completion.

**Why:** The user explicitly requires SendFlow's logic to be solid and correctly applied before development continues.

**How to apply:** For each financial or security change, define the invariant and its trust boundary, exercise failure and concurrent cases without touching shared Neon or real services, and list any infrastructure-dependent checks that remain blocked before starting dependent work.
