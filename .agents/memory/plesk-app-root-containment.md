---
name: Plesk application-root containment
description: Plesk requires distinct Node application roots and a document root nested inside each application root.
---

In the user's Plesk panel, a second Node.js app was rejected because another app already used that application root; Plesk also requires the document root to be inside the selected application root. The repository's documented API app root (`artifacts/api-server`) and private empty document root (`artifacts/plesk-empty-document-root`) are siblings, so that pair does not satisfy the observed panel constraint.

**Why:** A successful package build does not verify Plesk's application-root validation, and the rejected layout prevents creating the separate API process needed for `/api`.

**How to apply:** Give the API its own application root and package its private empty document root beneath that root; never expose the API bundle as the document root. Keep documentation and payment subdomains as aliases routed to the shared site/API processes, not duplicate Node apps.
