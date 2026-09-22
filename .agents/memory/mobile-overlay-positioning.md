---
name: Mobile overlay positioning
description: Fixed mobile overlays must escape transformed ancestors to remain attached to the viewport.
---

Render full-screen mobile overlays through a document-level portal rather than inside an animated or transformed card.

**Why:** A transformed ancestor creates a containing block for descendants with `position: fixed`, so the overlay can move with the card and place bottom controls outside the mobile viewport.

**How to apply:** When an overlay must stay fixed while the page is locked, render it into `document.body`, then measure it on a mobile viewport before considering its layout stable.