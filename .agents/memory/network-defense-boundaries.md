---
name: Network defense boundaries
description: Scope and safety rules for SendFlow's automatic blocking of malicious HTTP requests.
---

Protect SendFlow against malicious requests and scanners, not against every new
client IP or every cloud-hosted server.

**Why:** The user clarified that the target is hostile requests from malicious
servers, not ordinary customer traffic. Blanket cloud/IP allowlisting would also
deny mobile customers and legitimate service providers.

**How to apply:** Keep detection behavior-based, distinguish individual request
refusal from an IP ban, and preserve legitimate customer access.
All automatic and manual IP bans are permanent until the owner's explicit,
audited release: no expiry, daily reset, elapsed-time release or restart reset.
Adding a trusted-IP exception must not release an existing ban.
Trusted-IP exceptions never bypass authentication, financial permissions or
webhook signatures.

**Why permanent bans:** The user explicitly corrected the temporary-ban approach:
“sa doit être bloqué définitivement jusqu'à ce que je décide”, emphasizing
“je dis bien définitive”. Do not silently reintroduce temporary bans to mitigate
false positives; tune detection instead and preserve explicit owner review.

Origin application protection does not establish hosting-wide coverage.

**Why:** Pages and API can follow different hosting paths. A CDN, static host or
directly reachable origin can bypass code-level checks even when isolated HTTP
tests pass.

**How to apply:** Verify proxy trust and every hosting path before claiming
Plesk-wide protection. Never simulate hostile traffic or seed bans in shared
Neon to prove the feature; use a disposable database and report infrastructure
checks separately.
