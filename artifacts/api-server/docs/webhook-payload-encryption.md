# Developer webhook payload storage

New outbox payloads use the existing AES-256-GCM sensitive-data helper with a
context-bound `sfenc-v2` envelope. Its authenticated context contains the stable
delivery ID and event type. The worker validates and canonicalizes the payload
before serializing it for delivery. The public JSON body and HMAC format remain
unchanged.

Legacy plaintext JSONB rows are still readable for compatibility, but are
strictly checked and rejected if they contain unknown properties. The worker
does not silently remove unknown legacy fields and then deliver the rest: an
invalid row is marked `failed` with the safe category `payload_invalid`.

## Key identifiers and rotation

`CUSTOMER_PII_ENCRYPTION_KEY` remains required. New context-bound envelopes use
`CUSTOMER_PII_ENCRYPTION_KEY_ID`, which defaults to `primary`. Historical
versioned keys can be supplied as a JSON object in
`CUSTOMER_PII_ENCRYPTION_KEYRING`, keyed by their identifiers. Never place key
material in source control, database rows, logs, or command output.

For a planned rotation of **new `sfenc-v2` webhook payloads only**:

1. Preserve the previous key material in the protected keyring under its exact
   prior ID.
2. Install the new key as `CUSTOMER_PII_ENCRYPTION_KEY`.
3. Set `CUSTOMER_PII_ENCRYPTION_KEY_ID` to a new, unique ID.
4. Confirm decryption of a retained non-production fixture before deploying.
5. Retain the old key until all ciphertext using it is migrated or expired under
   an approved retention policy.

Changing the key without changing its ID and retaining the old key is not a
rotation procedure. If an envelope references an unavailable key ID, decryption
fails closed without disclosing key material.

This keyring does **not** make the application's older `sfenc-v1` data
rotatable. That envelope does not carry a key ID; changing the global key can
make existing v1 customer, endpoint, and other encrypted fields unreadable.
Do not rotate the shared key until a separately reviewed, complete migration
plan covers every v1 column and has been tested against an isolated database.

## Historical outbox rows

No historical rows are rewritten automatically. Plaintext legacy rows remain
deliverable only if they match the strict current event schema. A future
backfill must be opt-in, batch-bounded, idempotent, verify ciphertext and
context before committing, preserve a documented recovery path, and be tested
against an isolated database. It must never target production without explicit
approval.
