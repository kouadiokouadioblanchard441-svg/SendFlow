---
name: Plesk auto-deployment
description: Preserve the user's chosen Plesk-side automatic Pull and build after GitHub pushes.
---

The user wants a GitHub push to trigger Plesk's own automatic Pull and post-pull build. Do not use a GitHub Actions SSH connection to Plesk.

Plesk's additional deployment-action environment has reported `git`, `dirname`, and `node` missing. Its actual Node.js executable path and whether pnpm is available there have not been verified remotely.

Plesk's deployment checkout can contain the source files without Git metadata; repository checks run after Pull must not require `git ls-files` to enumerate source. The secret scan now falls back to a bounded filesystem walk when Git metadata is unavailable.

**Why:** The user explicitly chose Plesk auto-deployment and rejected needing manual build steps or GitHub-to-Plesk SSH credentials.

**How to apply:** Do not assume the deployment action inherits the app's Node.js PATH or invent a Plesk binary path. Keep generated builds out of Git; make the action use verified runtime paths and fail closed if they are unavailable. Keep source checks independent of Git metadata when Plesk runs them. A local build does not create or verify Plesk distributions.
