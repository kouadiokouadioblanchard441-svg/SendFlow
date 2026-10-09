---
name: SendFlow Capacitor direction
description: SendFlow will use Capacitor at app.africa.sendflow.africa, with its API routed under /api on the same Replit domain.
---

SendFlow is being prepared for an Android Capacitor wrapper. Keep the existing React web UI and remote backend; do not migrate backend logic, database access, secrets, or financial authority to the device.

The planned app domain is `https://app.africa.sendflow.africa`; the API will share that host and remain routed under `/api`. This confirms the application/API origin, not the production database host.

The user requires phase-gated execution: complete one phase, deliver its report or result, and wait for an explicit "OK" before continuing. Phase 1 must identify and validate the existing stack and exact web build directory before any Capacitor installation or code changes.

**Why:** The user specified a strict approval protocol and requires the application UI to remain inside Capacitor's native WebView while the backend stays remote. The public app/API domain was confirmed as `app.africa.sendflow.africa`.

**How to apply:** Work only on the currently approved phase. Preserve existing product behavior and UI; keep secrets and financial decisions server-side. Use the confirmed HTTPS origin and `/api` routing when configuring the client and allowed origins. Do not install Capacitor, create Android files, or proceed to another phase until the user approves the preceding phase.
