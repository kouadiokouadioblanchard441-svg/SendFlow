---
name: Documentation portal visual identity
description: User-required structure, branding, and production URL rules for the SendFlow API documentation.
---

Use the supplied API-documentation reference's Inter typography while retaining the SendFlow palette: pure white `#fff`, ink `#17181d`, body text `#292a30`, violet `#8b4cc8` (deep `#7736b5`), and lavender surfaces/borders `#fbf8ff` / `#e8dcf9`. Keep documentation cards and sidebar navigation groups clearly framed.

Organize the portal with clear groups for getting started, hosted checkout, integration, webhooks, reliability, and resources. Keep one menu entry per guide page rather than listing every subsection. The direct API guide contains its workflow, examples, endpoint contracts, catalog, and limits on one vertically scrollable page. Keep every section tied to SendFlow features verified in the code.

Structure the getting-started page as a concise merchant introduction, the two integration paths, supported capabilities, exact production URLs, a short recommended flow, and a scannable quickstart with tabbed examples for catalog, session creation, payment attempt, and status lookup. Use only SendFlow endpoints and production domains. Keep backend-internal readiness flags and deployment details out of public documentation.

Keep code panels focused on the language tabs, code, and copy control; do not repeat generic environment/setup footers beneath every sample. Preserve one concise production integration note near the quickstart examples and keep any endpoint-specific explanation next to the relevant step.

Public documentation must use the SendFlow brand exclusively. Do not mention payment providers, aggregators, or technical partners in prose, snippets, errors, examples, or labels. Operator names may appear only when needed to explain a verified payer flow.

Give each exposed merchant API operation examples that match its route and schema: PAYIN/session/attempt flows, catalog and limits, payout quote/create/list/read/cancel, and webhook verification. Verify implementation status before describing availability; fail-closed payout creation must be shown as HTTP 503 with no request or funds reservation. Do not present customer-app-only routes as merchant integrations or invent endpoints.

Show each production URL in its own copyable block, styled like a code panel; keep prose free of raw URL strings. Wrap long URLs on narrow screens without changing the copied value.

Merchant API code examples must also resolve to the actual production API base, not only refer to an unset environment variable. Hosted Checkout examples must show the production checkout origin when composing the payer URL. Keep URL definitions centralized and keep secret keys environment-only.

**Why:** the user wants external references to guide typography while preserving SendFlow's identity, with guide content organized for scrolling rather than a crowded menu of endpoint and subsection entries.

**Why:** the user asked for a professional API-provider-style start page that leads with the product and production integration details rather than internal implementation status.

**Why:** the user wants practical code examples for each SendFlow merchant API flow, using the actual production contract and keeping the infrastructure behind SendFlow invisible.

**Why:** the user asked for the actual production URLs inside applicable code examples, not only in standalone copy blocks.

**How to apply:** define production domains once and render them into each applicable API sample as a working default, while allowing an environment override. Include the hosted checkout origin only in examples that construct a payer redirect, and keep the secret API key environment-only. Render every production URL in its own copyable block, keep raw URL strings out of prose, and wrap them on mobile. Use Inter only within the docs portal across desktop and mobile; keep the existing SendFlow palette and left-side expandable navigation. Keep Hosted Checkout separate, put all direct API integration details in one scrollable guide, and leave section headings inside each page rather than the sidebar. Use operator names only for verified payer instructions, and search public docs and examples for partner names before release. On the start page, present the SendFlow introduction, Hosted Checkout and Direct API paths, capabilities, production URL settings, recommended merchant steps, and quickstart code tabs for supported languages. Keep the production integration note once near the quickstart, not repeated under each code sample; preserve only context-specific notes beneath an example. Verify each example against the live source schema and route; do not turn internal customer-app endpoints into public merchant API examples.
