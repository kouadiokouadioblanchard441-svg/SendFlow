---
name: Free image cleanup
description: Local cleanup for generated PNGs that visually contain a checkerboard background.
---

Before cleaning a checkerboard-looking PNG, inspect its alpha channel: some image viewers display genuine transparency as a checkerboard, while image generation can also bake the pattern into opaque pixels. A transparent-background request does not guarantee alpha, and several disconnected checkerboard islands may survive an edge flood-fill. For baked patterns, start with a low-fuzz edge flood-fill and composite against the page color; higher fuzz can erase pale parts of the subject, and isolated background patches may need separate seeds. Verify the cutout at its intended browser display size.

**Why:** Generated PNGs can contain either a real alpha channel or a baked checkerboard; broad color removal can damage light subject details, while an edge-only pass can leave disconnected tiles.

**How to apply:** Check image metadata first; if transparency is absent, use a separate cleaned asset, remove only identified background areas, compare it over the actual page background at its display size, then keep only the verified output.