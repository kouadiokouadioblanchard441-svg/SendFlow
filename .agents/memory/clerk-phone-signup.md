---
name: SendFlow signup authentication
description: The branded signup screen collects a phone number, while the current managed Clerk setup does not support phone/SMS authentication.
---

The SendFlow signup screen should not claim to create an account until the authentication method is confirmed. The current UI preserves the reference flow and performs local validation only.

**Why:** The requested design is phone-first, but the configured managed Clerk tenant supports email/password and selected SSO providers rather than phone/SMS sign-in.

**How to apply:** Before wiring the Create action, confirm whether SendFlow will use email/password, a supported external phone provider, or a different authentication service. Keep the existing visual structure unchanged.