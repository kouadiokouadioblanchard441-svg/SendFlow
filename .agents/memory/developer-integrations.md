---
name: Merchant developer API
description: Product decisions for merchant API credentials, payment sessions, and webhooks.
---

The merchant-space “Développeurs” area supports both direct API checkout and SendFlow-hosted checkout. Both payment modes must reuse LinkFlow’s configured country/operator fees and aggregator routing; do not hard-code a provider in the developer API. Webhooks may be emitted only for verified final payment results, after the existing settlement path credits the merchant wallet. Public integration documentation is a later milestone.

Each account receives one active public/secret API key pair during registration. Store only the public key and one-way hashes; return the secret only in the creation response, never persist or log it. Regeneration atomically revokes all currently active pairs and retains their revoked history. Live credentials must remain unavailable to test accounts, and API payment execution must stay closed until provider settlement evidence is validated.

The owner-authorized viewing account receives a non-live, test-prefixed API key pair during provisioning. Those credentials must never authenticate live payment endpoints or trigger provider calls or webhook deliveries. Determine preview status from the server-validated session, never from client input; keep all other preview routes fail-closed.

The API-key storage constraint must accept both live and preview key formats; enforce the live/test boundary in server authorization rather than rejecting preview credentials at insertion.

**Why:** the user wants a key pair at account creation and the ability to regenerate it; one-time secret delivery avoids a recoverable plaintext credential, while rotation must invalidate old integrations.

**How to apply:** Create the initial pair in the registration transaction and expose it only in the signup response. Keep the secret in frontend memory only until the user continues. Serialize rotations per account and preserve revoked records. Keep session creation and success webhooks closed while `isLinkFlowPaymentExecutionEnabled` is false. Live API keys must not be issued to test accounts; the authorized preview account uses distinct test-prefixed credentials. Ask before applying the additive developer schema migration to Neon.

**Why:** the user wants to inspect and test key management in the visualization account, while that preview shares Neon with production and must not initiate real financial activity.

**How to apply:** Generate the viewing account's pair during provisioning; for a legacy viewer with no active pair, allow one authenticated, idempotent initialization. Keep key list/rotation/revocation owner-scoped, reject test prefixes in live authorization, and leave payment-session and webhook-delivery routes blocked.

**Why:** Neon previously rejected the viewing account's test-prefixed public key before the initialization route could complete.

**How to apply:** When changing credential constraints, verify preview-key creation and separately verify that live payment authorization still rejects test credentials.

For the merchant API-key card, follow the supplied reference: one clean, lightly outlined card; place “Régénérer” at the upper-right beside “API”; show the tabs, grey credential row, gold outlined eye/copy controls, and update date inside that frame. Avoid an extra nested border or a full-width mobile regeneration button.

**Why:** the user corrected the prior layout because the card contour and regeneration-button position did not match the reference.

**How to apply:** Keep this visual treatment scoped to Développeurs and compare the mobile layout against the supplied screenshot before changing the card again.
