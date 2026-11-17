---
name: Plesk Node runtime
description: The Node.js version currently used by the SendFlow Plesk deployment.
---

The user currently states that Plesk uses Node.js 22 with Passenger; the prior shared panel screenshot showed Node.js 24.22.3. The current Plesk selector must be treated as the authority. The build is pinned to Node.js 22.23.4 to match the user's latest statement.

**Why:** The build/runtime major-version mismatch affects native package compatibility and whether the startup artifact is suitable for Plesk.

**How to apply:** Before a future Plesk release, verify the Node.js major and patch selected in the actual Plesk panel; rebuild if it differs from the pinned builder runtime.
