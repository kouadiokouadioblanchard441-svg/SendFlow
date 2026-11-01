---
name: SendFlow sensitive-data encryption
description: User requirements for server-side encryption of SendFlow data and the boundary between it and strict E2EE.
---

The user requires every requested customer-signup field to be mandatory. Passwords must remain non-reversible salted hashes.

The user confirmed application-level encryption with server-side decryption for data that SendFlow must process. Do not call this strict end-to-end encryption: the backend must read customer, identity, and payment data to perform authorized operations.

The user requires transfers to remain server-routed and protected in transit and at rest. Do not use strict client-only E2EE for fields needed by payment processing, account recovery, or authorized identity review.

The user confirmed that encryption at rest must include financial values as well: transaction amounts, fees, and wallet balances.

For large-scale ledger behavior, the user selected numeric SQL columns for amounts, fees, and balances protected by database storage encryption, while personal identifiers use application-level encryption. Server-side transaction processing and SQL financial invariants must remain functional.

**Why:** The user explicitly requested mandatory registration information and both types of encryption.

**How to apply:** Do not describe server-side encryption as strict E2EE. Keep data needed by OTP, validation, or account operations server-processable with transport protection and encryption at rest; reserve strict E2EE for data the server never needs to inspect.

Webhook payloads use a context-bound, key-ID-bearing envelope for new records. The generic legacy `sfenc-v1` envelope has no key identifier, so changing the shared master key can make existing encrypted columns unreadable; do not rotate it until a complete migration plan covers every v1 field. The webhook keyring only preserves decryptability for key-ID-bearing v2 payloads.

**Why:** A partial keyring must not be mistaken for application-wide key rotation support.

**How to apply:** Before changing `CUSTOMER_PII_ENCRYPTION_KEY`, inventory every encrypted field and ciphertext version, preserve required historical keys, and test a staged migration on an isolated database.
