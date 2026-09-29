---
name: PIN unlock boundaries
description: Security invariants for concurrent PIN verification and browser lock state.
---

PIN verification and PIN-change authorization must serialize attempts for both the account and requester before checking limits, verifying secrets, recording failures, or clearing them. The browser's unlock indicator is only a presentation hint; sensitive account responses still require a server-verified unlock, and displayed/cached account data must disappear when that unlock expires.

**Why:** If attempts are counted only after verifying a PIN, simultaneous guesses can all pass a pre-check before any failures are recorded. A browser flag that outlives the server's PIN window can also keep previously loaded account information visible.

**How to apply:** Preserve cross-instance, consistently ordered locks around PIN checks and rate-limit updates. Keep the client deadline slightly ahead of the server's, clear user-scoped caches on lock and authentication changes, and verify concurrent behavior against an isolated database rather than the shared Neon environment.