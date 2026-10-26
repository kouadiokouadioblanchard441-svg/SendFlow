---
name: LinkFlow payment integrity and fee rules
description: Rules for payment states, viewer simulations, merchant fees, link deletion, and LinkFlow analytics.
---

Never present a LinkFlow payment as pending or ask a payer to authorize USSD unless a persisted, server-owned payment attempt has actually been initiated and is still pending. Show a success screen only after the server reports a final succeeded state backed by verified settlement evidence.

**Why:** A display-only form or unconnected provider integration can mislead a payer into dialing USSD without a matching merchant transaction; browser state is falsifiable.

**How to apply:** Keep previews visibly non-operational. Connect public waiting and success screens only to authoritative server payment state and verified provider evidence; browser redirects, local state, and unverified webhooks cannot establish success.

Do not configure a generic operator menu code as a LinkFlow payment-authorization code. Only show instructions explicitly confirmed for the selected provider flow; OTP or USSD instructions that depend on the transaction must be generated from that transaction, not stored as a static country/operator code.

**Why:** The user chose to add only codes confirmed to authorize a LinkFlow payment, not general Mobile Money menu codes.

**How to apply:** Derive the waiting screen from a real server-owned provider attempt and its documented authorization model. Keep static USSD settings empty unless their role in authorizing that exact payment flow is verified.

The authorized Replit viewer may create and inspect LinkFlow links without a PIN because that provisioned account has no PIN, but only while its active preview grant is valid and only in the Replit shared-Neon environment. Its simulator must return an unmistakable simulation outcome, make no provider request, and create no payment attempt, transaction, ledger entry, or balance change.

**Why:** The owner needs to review the complete LinkFlow screen flow in Replit, while the same Neon database is shared with Plesk and must never mistake a preview for a real settlement.

**How to apply:** Limit the PIN exception to viewer-only link list/create/image operations in Replit; keep PIN checks for ordinary customers and all financial operations. Keep simulation results ephemeral and explicitly state that no charge or USSD request occurred.

For LinkFlow, the amount chosen by the merchant is the payer’s total debit. Deduct SendFlow fees from that amount when calculating the merchant’s net proceeds; never add the fee on top or show a fee breakdown on the payer-facing page.

**Why:** The user explicitly defined the public-link amount as the exact amount debited from the payer, with SendFlow fees included in it.

**How to apply:** Keep fee calculations server-side, use the recipient-pays-fees calculation for LinkFlow only, and expose only the fixed payer total in the public checkout.

A LinkFlow link with no fixed amount is stored with amount zero and lets the payer choose the amount at checkout; currently this is supported only in XOF, with server-side validation from 100 to 2,000,000 XOF. An empty description is valid and should not create empty visible copy. Fixed links must continue using the stored amount.

**Why:** The user requires amount and description to be optional when creating a link, with the payer setting the amount only when the merchant left it blank.

**How to apply:** Treat zero as the variable-amount sentinel only for XOF. Put the payer input inside the top bold amount panel, not in a separate field below. Require the value for quotes, simulations, and attempts, validate it on the server, include it in idempotency fingerprints and fee calculations, and never let a payer replace a fixed amount.

For shared-Neon migration plans, normalize PostgreSQL-rendered constraint definitions before testing them; `pg_get_constraintdef` may quote numeric constants and include casts.

**Why:** A valid existing LinkFlow schema was initially rejected because the planner expected an unquoted numeric literal.

**How to apply:** Compare normalized constraint semantics and fingerprint the reviewed schema state before applying a narrowly scoped migration.

For LinkFlow, expose only payment methods with a functioning end-to-end flow. Mobile Money is the method being added now; keep USDT and bank-card choices hidden until their payment flows are implemented.

**Why:** The user stated that Mobile Money is the only method to add at the current stage, while USDT and card are future methods.

**How to apply:** Show the Mobile Money payer fields only when Mobile Money is selected. Do not list unsupported methods as selectable options.

After a LinkFlow payment is conclusively confirmed, credit the merchant’s SendFlow wallet with the net amount after SendFlow fees, exactly once.

**Why:** The user explicitly chose wallet credit after FeexPay confirmation and confirmed that SendFlow fees are deducted from the payer’s fixed total.

**How to apply:** Use the server-calculated recipient amount in the existing guarded payment-intent and ledger transaction; never credit on a pending, failed, or uncertain result.

For LinkFlow, deletion is a soft revocation: invalidate and hide the public link while retaining its record and history. Do not show invented views, visitors, attempts, successes, or collected amounts; payment statistics remain unavailable until real payments are activated and metrics come from authoritative server/provider records.

**Why:** The user explicitly chose history-preserving deletion and deferred complete statistics until real payments are available.

**How to apply:** Filter deleted links from owner lists and all public endpoints, but retain their database rows. Never count viewer simulations as payments or derive financial analytics from browser state.

For public LinkFlow, show a failed payment as “Paiement non confirmé” only after the server confirms failure. Keep this separate from an expired-link screen.

**Why:** The user chose “Paiement non confirmé” for payment failure after sharing a separate “Lien expiré” reference screen.

**How to apply:** Preserve distinct server-owned outcomes for pending, failed, succeeded, and expired links; do not treat an expired link as a failed payment or a browser preview as a real result.

After server-confirmed LinkFlow success, keep the success screen visible until the payer clicks “Terminer”. Then navigate to the merchant return URL if configured; otherwise go to `https://sendflow.africa`. Never redirect automatically after a delay.

**Why:** The user explicitly chose to let the payer see the success result before continuing, with SendFlow as the fallback when the merchant has no return URL.

**How to apply:** Put all post-success navigation behind the success button, and ensure the merchant URL wins over the fixed SendFlow fallback.
