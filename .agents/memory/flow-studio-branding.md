---
name: Flow Studio branding
description: Distinguishes Flow Studio product branding from Replit platform identifiers in SendFlow.
---

Use “Flow Studio” for product-level attribution and branding where the user asks to replace Replit. Keep the SendFlow app/product name unchanged unless the user explicitly requests a rename.

**Why:** Replit environment identifiers, package coordinates, preview configuration, and database/payment isolation checks are functional platform references, not branding. Replacing them literally can break the workspace or weaken fail-closed safeguards.

**How to apply:** Replace branding comments or customer-visible text and verify built web/Android artifacts. Preserve `REPL_ID`, `REPLIT_*`, `.replit`, `@replit/*`, and related security guards while Replit compatibility is required; remove them only as part of an explicitly approved migration away from Replit.
