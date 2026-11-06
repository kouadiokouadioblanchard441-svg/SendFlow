---
name: Plesk auto-deployment
description: Preserve the user's chosen Plesk-side automatic Pull and build after GitHub pushes.
---

The user wants source pushes to `main` to trigger a GitHub Actions build using Node.js 24.22.2 and pnpm 10.26.1. CI runs checks, builds the Plesk production packages, and commits only `artifacts/dist`, `artifacts/api-server/dist`, and the root launcher to `main` for Plesk to Pull. Do not use GitHub Actions SSH to Plesk.

Plesk's additional deployment-action environment has reported `git`, `dirname`, and `node` missing. Its actual Node.js executable path and whether pnpm is available there have not been verified remotely.

Plesk's deployment checkout can contain the source files without Git metadata; repository checks run after Pull must not require `git ls-files` to enumerate source. The secret scan now falls back to a bounded filesystem walk when Git metadata is unavailable.

**Why:** The user explicitly asked for production build files to be published in the Git repository Plesk retrieves, without manual artifact commits or GitHub-to-Plesk SSH credentials.

**How to apply:** Build and commit only verified production outputs in GitHub Actions; keep unrelated generated directories and dependencies ignored. Do not assume the Plesk deployment action inherits Node/pnpm or invent binary paths. Keep Plesk's post-Pull check shell-only and fail closed if required package files are missing.
