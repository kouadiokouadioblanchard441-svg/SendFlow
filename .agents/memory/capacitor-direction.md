---
name: SendFlow Capacitor direction
description: The planned SendFlow app will use Capacitor; implementation instructions are forthcoming.
---

SendFlow is being prepared for an Android Capacitor wrapper. Keep the existing React web UI and remote backend; do not migrate backend logic, database access, secrets, or financial authority to the device.

The user requires phase-gated execution: complete one phase, deliver its report or result, and wait for an explicit "OK" before continuing. Phase 1 must identify and validate the existing stack and exact web build directory before any Capacitor installation or code changes.

**Why:** The user specified a strict approval protocol and requires the application UI to remain inside Capacitor's native WebView while the backend stays remote.

**How to apply:** Work only on the currently approved phase. Preserve existing product behavior and UI; keep secrets and financial decisions server-side. Do not install Capacitor, create Android files, or proceed to another phase until the user approves the preceding phase.
