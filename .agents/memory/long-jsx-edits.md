---
name: Long JSX edits
description: A reliable editing pattern for generated or compact one-line JSX files.
---

When a JSX file contains very long one-line sections, prefer adding or replacing content around short, stable anchors instead of attempting a full-line replacement. For copy wiring, prefer a data-driven helper or extracted component over repeatedly replacing the whole line.

**Why:** Long-line patches are brittle when a single character, entity, or nested fragment differs; short-anchor insertion is easier to apply and verify.

**How to apply:** Use `apply_patch` on surrounding short tags or boundaries, then run the artifact typecheck and refresh the workflow logs before presenting the result. Long-line replacements can fail on Unicode punctuation or nested JSX even when the visible text appears identical.