---
name: LinkFlow pending-state integrity
description: Rules for displaying USSD waiting states on public payment links.
---

Never present a LinkFlow payment as pending or ask a payer to authorize USSD unless a persisted, server-owned payment attempt has actually been initiated and is still pending.

**Why:** A display-only form or unconnected provider integration can mislead a payer into dialing USSD without a matching merchant transaction; browser state is falsifiable.

**How to apply:** Keep previews visibly non-operational. Connect the public waiting screen only to authoritative server payment state and verified provider status, with polling or webhooks that cannot mark a payment successful by themselves.
