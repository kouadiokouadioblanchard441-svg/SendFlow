---
name: LinkFlow fee availability
description: Preserve independent operator-level LinkFlow fees and hide disabled countries from customer-facing fee lists.
---

LinkFlow fees are configured independently for every operator and country. Newly added operators should receive an unconfigured LinkFlow rate rather than inheriting a different operation's fee. Keep disabled countries available to administrators for rate maintenance, but exclude them from customer-facing LinkFlow pricing; the underlying rate history remains stored.

**Why:** The user explicitly asked to configure LinkFlow by country and operator, have new countries/operators appear in the pricing panel, and stop displaying a country after it is disabled.

**How to apply:** Keep the LinkFlow fee category separate from Deposit and aggregator routing. When adding country/operator catalog behavior, make the admin catalog dynamic and only filter disabled countries from customer-facing LinkFlow views.
