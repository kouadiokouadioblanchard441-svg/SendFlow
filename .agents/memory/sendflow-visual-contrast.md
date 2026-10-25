---
name: SendFlow visual contrast
description: The user's visual direction for SendFlow customer-facing pages.
---

For SendFlow, customer-facing pages should not look pale or washed-out. Prefer white surfaces over an all-purple background, with violet used as a clear accent and a slightly raised finish where appropriate. LinkFlow must remain visually stable and keep its existing page structure; its create form should feel firmly framed without changing the field order or layout.

**Why:** the user asked for a professional financial app with strong readability, clarified that LinkFlow's purple background was too much and should use white like the Deposit page, and repeated that its frame must not move or change structure.

**How to apply:** when styling SendFlow pages, use white cards on a cool neutral background, keep body text and controls high-contrast, and reserve violet for selected controls, focus states, and primary actions. On LinkFlow's create form, strengthen the panel and controls with consistent borders and restrained depth while preserving every field and its order. Preserve natural vertical scrolling; avoid motion that repositions UI, prevent horizontal spill, and keep requested artwork fixed.

The public LinkFlow checkout should follow the supplied clean, white, merchant-first mobile payment layout: prominent merchant and amount, compact fee information, and vertically stacked payer fields. Use SendFlow's official wordmark and restrained violet accents. Viewer-only simulation must be explicit but visually secondary, never a large developer banner that displaces the payer flow.

**Why:** the user asked for a SendFlow-branded version of the FeexPay checkout and rejected a simulation-heavy layout that obscured the payment form.

**How to apply:** preserve the server-owned fee quote and actual country/operator options; do not invent payment methods to improve the appearance. Keep simulation access scoped to the authorized viewer and label its outcome as a test.
