---
name: Customer profile storage
description: Preserve exact first/last-name boundaries in SendFlow without adding database columns.
---

Updated profile names are stored as a versioned structured value inside the existing encrypted display-name field. The existing 512-character column limits the encoded name payload size. Old plain full names remain readable using the historical first-word split; display-name consumers must format the structured form back to a human-readable full name.

**Why:** The shared database must not be migrated without authorization, and splitting a multi-word given name from the combined display name would silently change the customer's profile after reload.

**How to apply:** Keep the structured payload encrypted with the existing user-name purpose, preserve its version prefix, and route every display-name response through the formatting helper. Do not add plaintext name or birth-date storage.
