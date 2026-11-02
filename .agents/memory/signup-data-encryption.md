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

New context-bound ciphertexts use a key-ID-bearing envelope. Legacy `sfenc-v1` data has no key identifier, so retain its old key in the server keyring while records remain. Deterministic lookup indexes also depend on a key; keep `CUSTOMER_PII_LOOKUP_KEY_ID` stable when rotating encryption keys.

**Why:** Encryption-key rotation must preserve old ciphertext access and database lookup behavior; changing the lookup key can make existing records unfindable even when they still decrypt.

**How to apply:** Preserve historical keys until encrypted records and restore requirements are covered. Rotate lookup-index keys only through a separately reviewed, idempotent reindex; test the rotation using isolated data before changing production configuration.
