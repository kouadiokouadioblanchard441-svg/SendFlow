---
name: Replit Node patch versions
description: Runtime catalog limits and custom Node patch-version setup in this SendFlow workspace.
---

Replit's managed `nodejs-24` module currently provides Node 24.22.1, while the Plesk panel currently offers Node 24.22.3. The managed module catalog does not offer the exact Plesk patch version; the official Node 24.22.3 Linux x64 binary is available for verified local builds.

**Why:** The production packaging script rejects a builder version that differs from the Plesk runtime, and Replit's managed module catalog only exposes the latest patch within a major version.

**How to apply:** Use the checksummed official binary temporarily for production builds when the managed module does not match; do not alter the Replit Run configuration merely to pin a build toolchain.
