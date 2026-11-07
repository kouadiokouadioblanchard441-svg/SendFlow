---
name: Replit Node patch versions
description: Runtime catalog limits and custom Node patch-version setup in this SendFlow workspace.
---

Replit's managed `nodejs-24` module currently provides Node 24.22.1, while the Plesk production builder requires exactly 24.22.2. The managed module catalog does not offer an exact 24.22.2 module. The official Node 24.22.2 binary can run the build when it is first on `PATH`.

**Why:** The production packaging script rejects 24.22.1, and Replit documentation says managed Node modules do not support selecting an exact patch. A persistent `.replit` `[run.env]` PATH override requires a `[run].args` command, which can change the primary Run-button behavior.

**How to apply:** Provision and verify the custom runtime and pnpm before removing the managed Node module. Keep the existing Project Run behavior unless its replacement is explicitly understood; do not claim the managed 24.22.1 module was removed when only a PATH override was added.
