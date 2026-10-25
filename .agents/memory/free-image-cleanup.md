---
name: Free image cleanup
description: Local cleanup for generated PNGs that visually contain a checkerboard background.
---

Before cleaning a checkerboard-looking PNG, inspect its alpha channel: some image viewers display genuine transparency as a checkerboard. Only clean files where the checkerboard is actually baked into opaque pixels. When needed, use a separate output asset and verify the browser render.

**Why:** Generated PNGs can contain either a real alpha channel or a baked checkerboard, and the image preview alone does not distinguish them. Cleaning a truly transparent asset would be unnecessary and can damage it.

**How to apply:** Check image metadata first; if transparency is absent, use a separate cleaned asset rather than overwriting the source, then verify the result in the browser.