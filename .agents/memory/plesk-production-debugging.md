---
name: Plesk production incident handling
description: Distinguish confirmed production symptoms from root causes during SendFlow Plesk incidents.
---

When diagnosing SendFlow production problems, explain each confirmed symptom before changing code. Separate upstream failures from downstream HTTP errors, and distinguish a successful Git push or build from a healthy Plesk runtime.

**Why:** The user explicitly asked for each problem to be explained before correction and objected when unverified changes were described as fixed. A generic startup label such as `Error` is not a root cause.

**How to apply:** Check live public endpoints and the exact Plesk application logs. Do not claim the production issue is resolved until the affected service responds correctly after Pull and restart. Never expose secret values to obtain diagnostics; report only safe categories and missing variable names.
