---
name: PIN unlock boundaries
description: Security invariants for concurrent PIN verification and browser lock state.
---

PIN verification and PIN-change authorization must serialize attempts for both the account and requester before checking limits, verifying secrets, recording failures, or clearing them. The browser's unlock indicator is only a presentation hint; sensitive account responses still require a server-verified unlock, and displayed/cached account data must disappear when that unlock expires.

**Why:** If attempts are counted only after verifying a PIN, simultaneous guesses can all pass a pre-check before any failures are recorded. A browser flag that outlives the server's PIN window can also keep previously loaded account information visible.

**How to apply:** Preserve cross-instance, consistently ordered locks around PIN checks and rate-limit updates. Keep the client deadline slightly ahead of the server's, clear user-scoped caches on lock and authentication changes, and verify concurrent behavior against an isolated database rather than the shared Neon environment.

PIN recovery must acquire the same user-scoped PIN attempt bucket before locking challenge or account rows, then clear that bucket in the transaction that writes the PIN and revokes sessions. Do not clear the requester-scoped bucket.

**Why:** A detached counter clear can race with a concurrent PIN check, and a failure after the PIN transaction commits can leave the user uncertain whether recovery succeeded.

**How to apply:** Reuse the authentication bucket identity and lock order for recovery; commit the challenge consumption, PIN update, session revocation, and user-counter clear together.

After a customer changes their PIN, every other active session for that user must be relocked in the same transaction; only the current valid session remains unlocked. Browsers must revalidate server PIN state and clear cached account data when the server reports a lock or invalid session. A session-status read should not extend activity timestamps.

**Why:** Another device must not retain financial-data access under a PIN that has just been changed, and locally cached data must not outlive the server's access decision.

**How to apply:** Keep the relock and current-session unlock atomic, and verify the behavior with an isolated database rather than the shared Neon environment.