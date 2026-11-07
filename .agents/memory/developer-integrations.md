---
name: Merchant developer API
description: Product decisions for merchant API credentials, payment sessions, and webhooks.
---

The merchant-space “Développeurs” area supports both direct API checkout and SendFlow-hosted checkout. Both payment modes must reuse LinkFlow’s configured country/operator fees and aggregator routing; do not hard-code a provider in the developer API. Webhooks may be emitted only for verified final payment results, after the existing settlement path credits the merchant wallet.

Public developer documentation must not reveal third-party processor or aggregator names. Describe routing limits generically; name an operator only when needed for payer instructions and only with verified details.

**Why:** the user explicitly set this public-documentation branding and accuracy rule.

**How to apply:** Scan public developer docs for third-party provider names before delivery. Distinguish Mobile Money operator names from upstream processors, and state unverified country/operator behavior as unconfirmed.

During documentation work, keep edits inside the developer documentation pages, presentation components, and code examples. Do not change payment routes or services, business rules, the database, authentication, secrets, global configuration, or the separate marketing site unless the user explicitly expands the scope.

**Why:** the user has repeatedly restricted SendFlow documentation work to that surface to protect existing production functionality.

**How to apply:** Report backend gaps as unavailable or unconfirmed instead of fixing them during a documentation-only task, and confirm the final diff contains only documentation files.

Each account receives one active public/secret API key pair during registration. Store only the public key and one-way hashes; return the secret only in the creation response, never persist or log it. Regeneration atomically revokes all currently active pairs and retains their revoked history. Live credentials must remain unavailable to test accounts, and API payment execution must stay closed until provider settlement evidence is validated.

The owner-authorized viewing account receives a non-live, test-prefixed API key pair during provisioning. Those credentials must never authenticate live payment endpoints or trigger provider calls or webhook deliveries. Determine preview status from the server-validated session, never from client input; keep all other preview routes fail-closed.

The API-key storage constraint must accept both live and preview key formats; enforce the live/test boundary in server authorization rather than rejecting preview credentials at insertion.

**Why:** the user wants a key pair at account creation and the ability to regenerate it; one-time secret delivery avoids a recoverable plaintext credential, while rotation must invalidate old integrations.

**How to apply:** Create the initial pair in the registration transaction and expose it only in the signup response. Keep the secret in frontend memory only until the user continues. Serialize rotations per account and preserve revoked records. Keep session creation and success webhooks closed while `isLinkFlowPaymentExecutionEnabled` is false. Live API keys must not be issued to test accounts; the authorized preview account uses distinct test-prefixed credentials. Ask before applying additive schema changes to the shared database.

**Why:** the user wants to inspect and test key management in the visualization account, while that preview shares a database with production and must not initiate real financial activity.

**How to apply:** Generate the viewing account's pair during provisioning; for a legacy viewer with no active pair, allow one authenticated, idempotent initialization. Keep key list/rotation/revocation owner-scoped, reject test prefixes in live authorization, and leave payment-session and webhook-delivery routes blocked.

**Why:** The previous shared database rejected the viewing account's test-prefixed public key before the initialization route could complete.

**How to apply:** When changing credential constraints, verify preview-key creation and separately verify that live payment authorization still rejects test credentials.

For the merchant API-key card, show one active pair only, with distinct “Clé API” (secret) and “Clé publique” tabs; keep revoked keys out of the current-key panel. Use SendFlow violet for regeneration, view, and copy controls.

**Why:** the user reported duplicate key cards and explicitly requested SendFlow violet instead of the gold reference controls.

**How to apply:** Keep this treatment scoped to Développeurs. Never persist the secret key in readable form or imply it can be recovered after its one-time display.

Do not show a separate “Révoquer” action at the bottom of the active API-key card; keep the webhook revocation control separate.

**Why:** the user asked to remove the bottom revocation mention from the API-key card.

**How to apply:** Use the immediate “Régénérer” action to replace the active API-key pair; do not remove webhook management controls.

Show a confirmation popup before API-key rotation, then show the returned public and secret keys inline in the active key card without a result popup. Keep the secret in frontend memory only until the page is left or reloaded.

**Why:** the user wants a clear warning before old keys are invalidated, while the new pair should remain directly available in the card.

**How to apply:** Disable the button while the request is pending, show an error if rotation fails, and never persist or log the secret. Keep webhook signing-secret dialogs separate.

For OTP documentation, distinguish the database-backed operator `requiresOtp` policy exposed by pricing from the connector’s technical channel flag that blocks merchant-checkout execution. `otpCommand` is menu/instruction metadata, not the customer’s OTP. Do not describe either flag as a complete live-production support list without checking the active catalog.

**Why:** these values come from separate sources and answer different questions; confusing them can make documentation claim an unsupported payment flow or publish an unverified operator instruction.

**How to apply:** In merchant docs, label the technical checkout restrictions separately from operator policies, never ask merchants to collect payer OTPs/PINs, and report production catalog status as unverified when the live API cannot be reached.
