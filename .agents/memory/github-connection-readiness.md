---
name: GitHub connection readiness
description: Avoid repeated connection attempts when GitHub authorization and workspace readiness disagree.
---

Do not treat successful integration attachment or a healthy OAuth report as proof that a task workspace can read GitHub.

**Why:** GitHub attachment and credential-health checks have succeeded while the integration catalog still reported `connect` and the connection form could not be opened. Repeating attachment and reconnection attempts did not resolve this disagreement.

**How to apply:** Check actual integration readiness before credential retrieval. If attachment does not make it ready and the connection form fails, stop repeating the same actions. Ask for access to be restored through Connected Services or for a complete Git bundle from a non-shallow clone. Keep the historical audit explicitly incomplete until the full source history is available.
