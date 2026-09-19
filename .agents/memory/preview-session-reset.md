---
name: Preview session reset
description: Preview screenshots use a fresh browser session rather than preserving sessionStorage between captures.
---

App preview captures do not preserve browser session state between calls. A stateful screen that needs direct visual inspection should expose a temporary, local-only preview selector during verification and remove it afterward.

**Why:** Waiting for an automatic transition did not advance a later screenshot because each capture loaded a new session and reset onboarding state.

**How to apply:** Use a short-lived query or fixture override only for the visual check, then revert it before the final build and workflow restart.