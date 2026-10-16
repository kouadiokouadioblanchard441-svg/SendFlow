---
name: SendFlow signup data encryption
description: User requirement for mandatory signup fields and use of both server-side and end-to-end encryption where feasible.
---

The user requires every requested customer-signup field to be mandatory and wants both server-side encryption and true end-to-end encryption where feasible. Define field boundaries before implementation: the server and OTP provider must process the phone number, and current registration logic validates and uses the name and birth date. Passwords must remain non-reversible salted hashes.

**Why:** The user explicitly requested mandatory registration information and both types of encryption.

**How to apply:** Do not describe server-side encryption as true E2EE. Keep data needed by OTP, validation, or account operations server-processable with transport protection and encryption at rest; reserve strict E2EE for data the server never needs to inspect. If the user requires E2EE for fields currently used by server logic, pause and redesign that workflow before changing code.
