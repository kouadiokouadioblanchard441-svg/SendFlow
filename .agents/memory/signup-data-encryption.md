---
name: SendFlow sensitive-data encryption
description: User requirements for signup and transfer data to be server-routed and encrypted, with strict E2EE boundaries clarified before implementation.
---

The user requires every requested customer-signup field to be mandatory and wants both server-side encryption and true end-to-end encryption where feasible. Define field boundaries before implementation: the server and OTP provider must process the phone number, and current registration logic validates and uses the name and birth date. Passwords must remain non-reversible salted hashes.

Before operator or partner integrations, the user requires every transfer operation to pass through the server and all data to be encrypted end to end. The exact meaning of "end to end" for server-processed transaction data is unresolved and must be clarified before implementation.

For transfer data the server must validate or process, the user chose HTTPS in transit plus encryption at rest, with the server authorized to decrypt. Do not use strict client-only E2EE for those fields.

**Why:** The user explicitly requested mandatory registration information and both types of encryption.

**How to apply:** Do not describe server-side encryption as strict E2EE. Keep data needed by OTP, validation, or account operations server-processable with transport protection and encryption at rest; reserve strict E2EE for data the server never needs to inspect.
