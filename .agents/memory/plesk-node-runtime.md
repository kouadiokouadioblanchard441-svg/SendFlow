---
name: Plesk Node runtime
description: The Node.js version currently used by the SendFlow Plesk deployment.
---

The user's latest Plesk panel screenshot shows Node.js 24.22.3 with pnpm and Passenger. The Plesk builder and GitHub Actions are pinned to Node.js 24.22.3.

**Why:** The Plesk-selected runtime is the deployment authority; matching its exact version avoids relying on unverified compatibility for native runtime packages.

**How to apply:** Before a future Plesk release, compare the Node version in the panel with the pinned build and rebuild if they differ.
