---
name: SendFlow Capacitor direction
description: SendFlow will use Capacitor at app.africa.sendflow.africa, with its API routed under /api on the same Replit domain.
---

SendFlow is being prepared for an Android Capacitor wrapper. Keep the existing React web UI and remote backend; do not migrate backend logic, database access, secrets, or financial authority to the device.

The planned app domain is `https://app.africa.sendflow.africa`; the API will share that host and remain routed under `/api`. This confirms the application/API origin, not the production database host.

The user requires phase-gated execution: complete one phase, deliver its report or result, and wait for an explicit "OK" before continuing. Phase 1 must identify and validate the existing stack and exact web build directory before any Capacitor installation or code changes.

**Why:** The user specified a strict approval protocol and requires the application UI to remain inside Capacitor's native WebView while the backend stays remote. The public app/API domain was confirmed as `app.africa.sendflow.africa`.

**How to apply:** Work only on the currently approved phase. Preserve existing product behavior and UI; keep secrets and financial decisions server-side. Use the confirmed HTTPS origin and `/api` routing when configuring the client and allowed origins. Do not install Capacitor, create Android files, or proceed to another phase until the user approves the preceding phase.

## Replit Android build toolchain

For Android builds in this Replit, use JDK 21 for Gradle. The default GraalVM 19 cannot run the Android JDK image transform, while JDK 17 is below this project’s Java 21 source level. Nix SDK outputs are read-only, so include every tool version Gradle requests; with API 36, include Build Tools 35.0.0 and 36.0.0. The build does not need an emulator or system image. The project owner explicitly authorized persistent Android SDK license acceptance, scoped to this pinned SDK composition.

**Why:** Gradle first attempted to install Build Tools 35 into the immutable Nix SDK, then failed on the workspace JDK 19 and JDK 17. The build succeeded with the SDK packages precomposed and JDK 21. The owner approved persisting license acceptance so the same SDK can be reconstructed in a fresh Repl.

**How to apply:** Keep license acceptance attached only to SendFlow's declared SDK composition. Do not broaden it to a global environment variable or commit Android license files. Derive Android build environment paths from the pinned SDK and JDK packages rather than copying machine-specific store paths.
