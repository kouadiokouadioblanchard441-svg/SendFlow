---
name: Merchant developer API
description: Product decisions for merchant API credentials, payment sessions, and webhooks.
---

The merchant-space “Développeurs” area supports both direct API checkout and SendFlow-hosted checkout. Both payment modes must reuse LinkFlow’s configured country/operator fees and aggregator routing; do not hard-code a provider in the developer API. Webhooks may be emitted only for verified final payment results, after the existing settlement path credits the merchant wallet. Public integration documentation is a later milestone.

Each account receives one active public/secret API key pair during registration. Store only the public key and one-way hashes; return the secret only in the creation response, never persist or log it. Regeneration atomically revokes all currently active pairs and retains their revoked history. Live credentials must remain unavailable to test accounts, and API payment execution must stay closed until provider settlement evidence is validated.

The owner-authorized shared-Neon viewing account may create and manage test-prefixed sandbox key pairs solely to preview key management. Sandbox keys must never authenticate live payment endpoints or trigger provider calls or webhook deliveries. Determine sandbox mode from the server-validated preview session, never from client input; keep all other preview routes fail-closed.

**Why:** the user wants a key pair at account creation and the ability to regenerate it; one-time secret delivery avoids a recoverable plaintext credential, while rotation must invalidate old integrations.

**How to apply:** Create the initial pair in the registration transaction and expose it only in the signup response. Keep the secret in frontend memory only until the user continues. Serialize rotations per account and preserve revoked records. Keep session creation and success webhooks closed while `isLinkFlowPaymentExecutionEnabled` is false. Live API keys must not be issued to test accounts; sandbox keys are distinct and view-only for the authorized preview account. Ask before applying the additive developer schema migration to Neon.

**Why:** the user wants to inspect and test key management in the visualization account, while that preview shares Neon with production and must not initiate real financial activity.

**How to apply:** Allow only owner-scoped key list/create/revoke operations when the server session confirms the preview grant. Keep sandbox prefixes rejected by live authorization and leave payment-session and webhook-delivery routes blocked.
