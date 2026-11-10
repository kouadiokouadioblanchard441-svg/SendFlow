---
name: Plesk application-root containment
description: Plesk requires distinct Node application roots and a document root nested inside each application root.
---

Plesk requires each Node.js app to use a distinct application root and its document root to be nested inside that root. For the API, keep the private empty document root under `artifacts/api-server`; the old sibling directory was not a valid Plesk layout.

**Why:** Plesk rejected the sibling document-root layout during setup, so a successful package build alone did not prove the API app could be configured.

**How to apply:** Give the API its own application root and package its private empty document root beneath that root; never expose the API bundle as the document root. Keep documentation and payment subdomains as aliases routed to the shared site/API processes, not duplicate Node apps.
