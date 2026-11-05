---
name: Plesk manual deployment
description: Preserve the user's chosen GitHub push, then Plesk Pull and Deploy workflow.
---

The user deploys manually: push to GitHub, then use Pull and Deploy in Plesk. Do not require GitHub Actions to SSH into Plesk or ask for SSH credentials for this normal flow.

**Why:** The user explicitly corrected the earlier assumption that GitHub should initiate an SSH deployment.

**How to apply:** Run the build in the Plesk checkout after Pull and distinguish that result from a local build; only Plesk can confirm its own generated distributions.
