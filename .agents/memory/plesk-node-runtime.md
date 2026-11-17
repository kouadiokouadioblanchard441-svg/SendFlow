---
name: Plesk Node runtime
description: The Node.js version currently used by the SendFlow Plesk deployment.
---

The user's latest Plesk panel screenshot shows Node.js 24.22.3 with pnpm and Passenger. The user confirms Plesk runs only one Node.js application per domain; the merchant site and its `/api` routes must therefore share one Passenger process. The Plesk builder and GitHub Actions are pinned to Node.js 24.22.3.

**Why:** The Plesk-selected runtime is the deployment authority; matching its exact version avoids relying on unverified compatibility for native runtime packages. The one-app-per-domain constraint means a second API application or fixed upstream port cannot be assumed.

**How to apply:** Before a future Plesk release, compare the Node version in the panel with the pinned build and rebuild if they differ. Keep same-domain APIs mounted in the site process unless the user confirms the hosting model has changed.
