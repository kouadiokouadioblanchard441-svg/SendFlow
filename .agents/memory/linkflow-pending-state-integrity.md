---
name: LinkFlow pending-state integrity
description: Rules for displaying USSD waiting states on public payment links.
---

Never present a LinkFlow payment as pending or ask a payer to authorize USSD unless a persisted, server-owned payment attempt has actually been initiated and is still pending. Show a success screen only after the server reports a final succeeded state backed by verified settlement evidence.

**Why:** A display-only form or unconnected provider integration can mislead a payer into dialing USSD without a matching merchant transaction; browser state is falsifiable.

**How to apply:** Keep previews visibly non-operational. Connect public waiting and success screens only to authoritative server payment state and verified provider evidence; browser redirects, local state, and unverified webhooks cannot establish success.
