---
name: SendFlow visual contrast
description: The user's visual direction for SendFlow customer-facing pages.
---

For SendFlow, customer-facing pages should not look pale or washed-out. Prefer white surfaces over an all-purple background, with violet used as a clear accent and a slightly raised finish where appropriate. LinkFlow must remain visually stable and keep its existing page structure; its create form should feel firmly framed without changing the field order or layout.

**Why:** the user asked for a professional financial app with strong readability, clarified that LinkFlow's purple background was too much and should use white like the Deposit page, and repeated that its frame must not move or change structure.

**How to apply:** when styling SendFlow pages, use white surfaces, high-contrast labels and clearly defined controls, and reserve violet for selected controls, focus states, and primary actions. On LinkFlow pages, preserve every field and its order, retain readable disabled states, prevent horizontal spill, and keep requested artwork fixed during natural scrolling.

The public LinkFlow checkout should follow the supplied clean, white, merchant-first mobile payment layout: prominent merchant and amount, vertically stacked payer fields, and no displayed fee or fee breakdown. Use SendFlow's official wordmark and violet accents. Viewer-only simulation must be explicit but visually secondary, never a large developer banner that displaces the payer flow.

**Why:** the user asked for a SendFlow-branded version of the FeexPay checkout, clarified that the link amount is the payer's total and fees must not appear on the checkout page, and rejected a simulation-heavy layout that obscured the payment form.

**How to apply:** preserve the server-owned amount and actual country/operator options; do not invent payment methods to improve the appearance or display internal fees. Keep simulation access scoped to the authorized viewer and label its outcome as a test.

For LinkFlow screens, treat the user-provided screenshots as the visual specification. Preserve their structure, positioning, and approved artwork instead of substituting generic generated illustrations.

**Why:** the user corrected a mismatch between the supplied LinkFlow mockups and a generic replacement illustration.

**How to apply:** compare the target screenshot before visual edits, reuse the established payment-page character artwork and LinkFlow background artwork where appropriate, and keep scroll backgrounds fixed.

LinkFlow deletion actions should use a strong, solid red treatment rather than a pale pink destructive style.

**Why:** the user explicitly requested a pure red Delete button for the link detail page.

**How to apply:** use a high-contrast red fill for both the delete action and its confirmation action, with accessible white text and a visible focus state.

Every public LinkFlow payment state should end with a “Paiement sécurisé par SendFlow” footer using the official wordmark and the approved 3D brand mark. Keep this treatment scoped to the payment-link flow.

**Why:** the user requested the same visible trust signature at the bottom of every LinkFlow payment page.

**How to apply:** render the shared footer on checkout, loading/unavailable, waiting, success, and failure states; do not add it globally to unrelated SendFlow pages.

For the unavailable-link state, use the approved original 3D expiry illustration in place of the CSS-drawn status icon; do not copy another provider's mascot.

**Why:** the user asked for a 3D visual similar in purpose to Jeko's expired-link illustration, specifically to replace the CSS icon on SendFlow's unavailable page.

**How to apply:** keep the illustration scoped to the unavailable-link state and preserve the existing payment journey and copy unless the user requests broader changes.

When opening or refreshing a public LinkFlow payment link, show a full-screen white loading state with a centered, pulsing four-dot SendFlow-purple mark for at least one second and until the link request settles; display the page immediately once both conditions are met.

**Why:** the user supplied mobile screenshots as the desired refresh/loading behavior for payment-link navigation.

**How to apply:** use the same minimum duration for initial loads, refetches and retries; do not add a delay after the request has finished and do not change payment or settlement logic.
