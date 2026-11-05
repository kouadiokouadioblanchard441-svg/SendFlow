---
name: Plesk pnpm build approvals
description: Keep Plesk dependency installation compatible with pnpm build-script approval formats.
---

Explicitly allow only the reviewed dependency build scripts in both `allowBuilds` and `onlyBuiltDependencies`; keep the two lists aligned and never approve all dependency scripts.

**Why:** Plesk rejected the esbuild lifecycle script despite the older allowlist; the compatibility configuration resolved the installation issue.

**How to apply:** When updating pnpm or diagnosing `ERR_PNPM_IGNORED_BUILDS` on Plesk, check the actual checkout and pnpm version, preserve the narrow dual-format allowlist, and verify the install on Plesk rather than claiming a local check proves production.
