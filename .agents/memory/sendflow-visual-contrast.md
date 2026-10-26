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

The LinkFlow checkout’s phone area should follow the approved FeexPay reference: centered network and phone labels, an uppercase operator selector with the paired up/down indicator, and a clearly segmented phone row for flag, synchronized country dial code, number entry, and the selected operator’s verified logo.

**Why:** the user explicitly requested an icon-by-icon, proportion-matched reproduction of the supplied mobile checkout capture for a financial app.

**How to apply:** keep the country and dial-code selectors synchronized, preserve the existing server-backed country/operator and payment validation rules, and use only a verified brand asset or a readable operator name fallback. Match the reference row proportions (flag ~15%, dial code ~22%, number input ~47%, operator logo ~15%); avoid minimum widths that compress the number field on mobile. Use the same violet border and focus treatment as other checkout fields, not a blue outline.

While the user is working on the payment-by-link page, keep changes scoped to that checkout route and its dedicated assets. Shared components such as operator logos may be reused when appropriate.

**Why:** the user explicitly limited the current work to the payment-by-link page, while clarifying that shared operator logos are expected.

**How to apply:** scope checkout styles to the public payment form. When extending a shared component, make the added behavior opt-in so its existing consumers keep their current rendering.

Keep the LinkFlow payment-success screen visually distinct from checkout. Preserve its spacious, full-screen confirmation layout instead of reusing the payment form's compact card styles.

**Why:** the user explicitly asked to restore the original large success page and rejected making it look like the checkout page.

**How to apply:** use success-specific shell, card, banner, and button styles for successful outcomes; keep checkout and failure styling independent.

For a failed LinkFlow payment, use the clean, white, merchant-first layout from the supplied reference instead of the checkout-style framed card; keep the “Paiement non confirmé” message and retry action.

**Why:** the user asked for the failure screen to return to its original, reference-based appearance.

**How to apply:** keep the server-confirmed failure, amount, no-credit explanation, retry behavior, and secure footer intact while styling the failure state independently.

On the LinkFlow success screen, keep the existing abstract banner background visible but restrained so it adds depth without competing with the confirmation text.

**Why:** the user asked for the success-page background artwork to be slightly more visible, but not overpowering.

**How to apply:** adjust only success-banner background layers and decorative arcs; preserve the success layout, contrast, and other payment states.

Keep LinkFlow's payment-waiting screen visually distinct from checkout: use a white full-height surface, soft-gray rounded blocks, a prominent USSD code, and clear yellow numbered steps instead of heavy dark outlines.

**Why:** the user asked to restore the waiting screen's original appearance and had supplied a clean FeexPay waiting-page reference.

**How to apply:** use waiting-specific layout styles while preserving the server status, merchant details, USSD action, instructions, and secure footer; do not change payment logic.
