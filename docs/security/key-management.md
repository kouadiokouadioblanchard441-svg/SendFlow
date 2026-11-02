# SendFlow key management

## Scope and trust boundaries

Secret material and every operation that uses it belong in the API server
environment, configured through Replit Secrets or the protected production
environment. Do not put secret values in frontend variables, HTML, JavaScript
bundles, Android/Capacitor assets, API responses, logs, examples, or Git.

| Configuration | Classification | Use |
| --- | --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | Public | Cloudflare widget site key; intentionally embedded in web and Android client bundles |
| `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL` | Public | Approved client routing metadata |
| `TURNSTILE_SECRET_KEY` | Server secret | Server-side Turnstile Siteverify only |
| `CUSTOMER_PII_ENCRYPTION_KEY` | Server secret | Active application encryption key |
| `CUSTOMER_PII_ENCRYPTION_KEYRING` | Server secret | JSON map of retained historical key IDs to key material |
| `CUSTOMER_PII_ENCRYPTION_KEY_ID` | Non-secret identifier | ID attached to new context-bound ciphertext |
| `CUSTOMER_PII_LOOKUP_KEY_ID` | Non-secret identifier | Stable key ID used for deterministic lookup hashes |
| Database URLs, payment API keys, webhook HMAC secrets, email credentials, session secrets, and Android signing credentials | Server/build secrets | Used only by their authorized backend or private signing job |

`VITE_*` is not a secrecy boundary. Vite has `envPrefix` disabled and receives
only the explicit public allowlist in `scripts/security/public-client-env.mjs`.
Adding a value to that allowlist makes it public by design. Never add a server
secret there.

## Encryption formats and compatibility

SendFlow currently reads:

- `sfenc-v1`: AES-256-GCM with a field-purpose binding, but no key ID in the
  stored envelope. Decryption tries the active key first and then the configured
  historical keyring. Authentication must succeed for exactly one key.
- `sfenc-v2`: context-bound AES-256-GCM with a key ID in the envelope. The
  matching current or historical key must be available.

New context-bound webhook payloads use the versioned `sfenc-v2` format. Existing
`sfenc-v1` values are not rewritten automatically. Missing, invalid, or
unavailable keys cause a safe server-side failure; key material and raw
cryptographic errors are not included in client responses or application logs.

The keyring accepts at most 32 key entries and 16 KiB of JSON configuration.
Each key value must contain at least 32 UTF-8 bytes. Keep historical keys only
for as long as encrypted records or supported recovery paths require them.

## Safe encryption-key rotation

Do not change `CUSTOMER_PII_ENCRYPTION_KEY` by itself. Existing `sfenc-v1`
ciphertexts have no key ID, and lookup hashes must continue using the same
lookup key until they are deliberately re-indexed.

For a planned rotation:

1. Identify the current `CUSTOMER_PII_ENCRYPTION_KEY_ID`. Preserve its current
   key material in Replit Secrets under that ID in
   `CUSTOMER_PII_ENCRYPTION_KEYRING`.
2. Set `CUSTOMER_PII_LOOKUP_KEY_ID` to that existing ID before changing the
   active encryption key. This keeps current database lookup hashes unchanged.
3. Configure a newly generated, independent 32-byte-or-longer key and a new
   `CUSTOMER_PII_ENCRYPTION_KEY_ID` in the server environment. Do not paste key
   material into chat, source files, or documentation.
4. Restart only the intended server environment. Run isolated decrypt/lookup
   compatibility tests and a read-only health check before considering the
   rotation complete.
5. Retain the old key in the keyring until all old ciphertext and operational
   restore requirements have been accounted for. Do not remove it based only
   on the age of the newest record.

`CUSTOMER_PII_LOOKUP_KEY_ID` defaults to the active encryption key ID for
backward compatibility. If that ID changes, existing deterministic hashes no
longer match. Re-indexing requires a separately reviewed, idempotent,
batch-based operation covering every hashed column, uniqueness constraint,
suppression list, idempotency fingerprint, and token lookup. This project change
does not execute or provide a production re-index/backfill.

Never delete or overwrite an old key until backups and restores have been
verified with the corresponding keyring. If a key is lost, ciphertext recovery
is not possible; do not respond by disabling decryption checks.

## Leak controls

`pnpm run check:secrets` scans tracked and untracked repository text without
printing matched values. `pnpm run check:public-artifacts` scans the web
distribution, HTML, JavaScript, source maps, Capacitor assets, Android build
outputs, and inspectable APK/AAB text entries. The root, Plesk, and Android
build flows run the public-artifact check after producing those assets.

The automated checks recognize the explicitly public Turnstile site key and
public routing values; they reject known credential formats, secret-valued
assignments, unsafe client-side environment access, and server/frontend import
boundary violations. API-response and log regression tests use synthetic
markers only.
