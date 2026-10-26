---
name: Free image cleanup
description: Local cleanup for generated PNGs that visually contain a checkerboard background.
---

Before cleaning a checkerboard-looking PNG, inspect its alpha channel: some image viewers display genuine transparency as a checkerboard, while image generation can also bake the pattern into opaque pixels. For baked patterns, start with a low-fuzz edge flood-fill and composite against the page color; higher fuzz can erase pale parts of the subject, and isolated background patches may need separate seeds. Keep the source and verify the final browser-sized render.

**Why:** Generated PNGs can contain either a real alpha channel or a baked checkerboard, and broad color removal can damage light subject details or leave isolated tiles.

**How to apply:** Check image metadata first; if transparency is absent, use a separate cleaned asset, compare it over the actual page background at its display size, then keep only the verified output.