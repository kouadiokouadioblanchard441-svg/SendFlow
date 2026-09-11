---
name: Free image cleanup
description: Local cleanup for generated PNGs that visually contain a checkerboard background.
---

When background-removal tooling is unavailable, generated PNGs can be cleaned locally with ImageMagick by making the near-white checkerboard colors transparent and verifying the result in the rendered app.

**Why:** The generation pipeline can return a TrueColor PNG with a visible checkerboard even when transparency was requested, and the dedicated removal callback may not be available in the current workspace mode.

**How to apply:** Use a separate `-clean.png` asset rather than overwriting the source, import the cleaned asset, and confirm the browser render—not only the file preview—has no checkerboard artifacts.