---
name: LinkFlow payment integrity and fee rules
description: Rules for payment states, viewer simulations, merchant fees, link deletion, and LinkFlow analytics.
---

Never present a LinkFlow payment as pending or ask a payer to authorize USSD unless a persisted, server-owned payment attempt has actually been initiated and is still pending. Show a success screen only after the server reports a final succeeded state backed by verified settlement evidence.

**Why:** A display-only form or unconnected provider integration can mislead a payer into dialing USSD without a matching merchant transaction; browser state is falsifiable.

**How to apply:** Keep previews visibly non-operational. Connect public waiting and success screens only to authoritative server payment state and verified provider evidence; browser redirects, local state, and unverified webhooks cannot establish success.

The authorized Replit viewer may create and inspect LinkFlow links without a PIN because that provisioned account has no PIN, but only while its active preview grant is valid and only in the Replit shared-Neon environment. Its simulator must return an unmistakable simulation outcome, make no provider request, and create no payment attempt, transaction, ledger entry, or balance change.

**Why:** The owner needs to review the complete LinkFlow screen flow in Replit, while the same Neon database is shared with Plesk and must never mistake a preview for a real settlement.

**How to apply:** Limit the PIN exception to viewer-only link list/create/image operations in Replit; keep PIN checks for ordinary customers and all financial operations. Keep simulation results ephemeral and explicitly state that no charge or USSD request occurred.

For LinkFlow, the amount chosen by the merchant is the payer’s total debit. Deduct SendFlow fees from that amount when calculating the merchant’s net proceeds; never add the fee on top or show a fee breakdown on the payer-facing page.

**Why:** The user explicitly defined the public-link amount as the exact amount debited from the payer, with SendFlow fees included in it.

**How to apply:** Keep fee calculations server-side, use the recipient-pays-fees calculation for LinkFlow only, and expose only the fixed payer total in the public checkout.

For LinkFlow, deletion is a soft revocation: invalidate and hide the public link while retaining its record and history. Do not show invented views, visitors, attempts, successes, or collected amounts; payment statistics remain unavailable until real payments are activated and metrics come from authoritative server/provider records.

**Why:** The user explicitly chose history-preserving deletion and deferred complete statistics until real payments are available.

**How to apply:** Filter deleted links from owner lists and all public endpoints, but retain their database rows. Never count viewer simulations as payments or derive financial analytics from browser state.
