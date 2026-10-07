---
name: Financial app hardening
description: Project-wide quality and security priorities for SendFlow.
---

Treat SendFlow as a financial application under active development. When hardening any page, prioritize security, protection and integrity of user data, correct server-side authorization, and safe behavior around financial actions.

**Why:** The user explicitly said SendFlow is a large financial application and security and data protection must remain central while strengthening its pages.

**How to apply:** For each page, identify sensitive data and money-moving actions, validate authorization and business rules on the server, prevent duplicate or partial operations, and test without modifying real accounts or the shared Neon database.
