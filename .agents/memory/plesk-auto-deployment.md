---
name: Plesk auto-deployment
description: Preserve the user's chosen Plesk-side automatic Pull and build after GitHub pushes.
---

The user wants a GitHub push to trigger Plesk's own automatic Pull and post-pull build. Do not use a GitHub Actions SSH connection to Plesk.

**Why:** The user explicitly chose Plesk auto-deployment and rejected needing manual build steps or GitHub-to-Plesk SSH credentials.

**How to apply:** Keep the build command in Plesk's post-pull deployment action. A local build does not create or verify Plesk distributions.
