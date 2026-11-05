---
name: Frontend asset tracking
description: Prevent clean GitHub builds from losing assets that exist only in the local uploads directory.
---

Keep frontend build assets inside tracked artifact source directories. In this workspace, `attached_assets/*` is globally ignored, so an imported image can work locally yet be absent from a clean GitHub checkout.

**Why:** The public web build failed on an image that existed in Replit but was not tracked by Git.

**How to apply:** Before relying on an imported asset in a production bundle, verify its path is tracked with Git and run the frontend build against the same clean-checkout inputs used by CI.
