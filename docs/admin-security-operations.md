# SendFlow administrator security operations

This document describes the server-side setup for the single administrator account. It intentionally contains no administrator hostname, account identity, credential value, or private URL.

## Current application behavior

- The ordinary sign-in form submits email, password, and a six-digit TOTP together.
- The server checks the singleton credential, active state, Argon2id password hash, and TOTP before creating a session.
- Access JWTs are RS256, short-lived, and checked against the live PostgreSQL session on every protected request.
- Refresh tokens are opaque, stored hashed, rotated on use, and the session family is revoked on detected reuse.
- Sessions have a 15-minute inactivity limit and an eight-hour absolute limit.
- Sensitive admin mutations use a fresh TOTP confirmation bound to the method, path, query, and request body; the authorization token is one-use.
- A host allowlist controls whether the static site presents the administrator surface. It is not authentication.
- Cloudflare Access, firewall rules, allowed hosts/origins/IPs, database migrations, and secret values are not considered active until configured and verified in the target deployment.

## Required environment variables

Configure values only in Replit Secrets or the deployment's protected environment settings. Never add values to source, documentation, frontend configuration, or build output.

| Variable | Purpose |
| --- | --- |
| `SENDFLOW_ADMIN_ALLOWED_HOSTS` | Exact administrator hostnames accepted by the web server, comma-separated. Hostnames only; no scheme, path, wildcard, or guessed value. |
| `SENDFLOW_ADMIN_ALLOWED_ORIGINS` | Exact HTTPS origins allowed to call the administrative API. |
| `SENDFLOW_ADMIN_ALLOWED_IPS` | Optional exact IP allowlist. Include only a verified fixed business VPN/office egress address. |
| `SENDFLOW_ADMIN_CSP_CONNECT_SRC` | Exact HTTPS API origins required by the admin interface's CSP. |
| `SENDFLOW_ADMIN_JWT_PRIVATE_KEY` | Server-only RS256 private signing key in PEM form. |
| `SENDFLOW_ADMIN_JWT_PUBLIC_KEY` | Matching public verification key in PEM form. |
| `SENDFLOW_ADMIN_JWT_ISSUER` | Expected JWT issuer. |
| `SENDFLOW_ADMIN_JWT_AUDIENCE` | Expected JWT audience. |
| `SENDFLOW_ADMIN_TOTP_ENCRYPTION_KEY` | Separate 32-byte key, base64url encoded, for authenticated encryption of the TOTP secret. |
| `SENDFLOW_ADMIN_REQUIRE_CLOUDFLARE_ACCESS` | Set to `true` only after the Access application and origin validation are configured and tested. |
| `SENDFLOW_CLOUDFLARE_ACCESS_TEAM_DOMAIN` | Cloudflare Access team-domain identifier used for JWKS validation. |
| `SENDFLOW_CLOUDFLARE_ACCESS_AUD` | Exact audience tag from the Access application. |
| `SENDFLOW_ADMIN_MAINTENANCE_DATABASE_URL` | A restricted-use connection to the same Supabase database for controlled schema/account maintenance; never use it as the web runtime connection. |
| `DATABASE_CA_CERT` | Trusted database CA certificate for verified TLS. |

Do not place the administrator hostname in the frontend or in `VITE_*` variables. Set host/origin values only in protected server/deployment configuration.

## Database rollout

1. Take and verify an encrypted database backup.
2. Review `lib/db/migrations/2026-11-09-single-super-admin-auth.sql` against the current database.
3. Apply the additive migration to the existing Supabase database with the designated database owner. It creates no second database and does not reset existing tables or financial data.
4. Run `scripts/admin-access-permissions.sql` with the actual application database role. Do not run it until the new tables exist. It removes app-role privilege to create or replace the single administrator and preserves append-only audit behavior.
5. Confirm the migration and privilege checks on a non-production copy before production approval.

The migration and permission script have not been applied automatically by this project change.

## One-time account initialization

Run only from a trusted interactive terminal after the database migration and server secrets are configured:

```sh
SENDFLOW_ADMIN_BOOTSTRAP_CONFIRM=I_UNDERSTAND \
  pnpm --filter @workspace/api-server run admin:bootstrap-super-admin
```

The command prompts without echoing the password, creates exactly one credential row, asks for a first valid authenticator code before activation, and prints recovery codes once. Keep the maintenance database URL and signing/encryption keys out of the command line and shell history; inject them through the protected environment. Do not run this command in a public workflow or preview.

If the row already exists, initialization fails instead of replacing it.

## Recovery

The controlled offline recovery command requires the administrator password and an unused recovery code, then enrolls and verifies a replacement authenticator before it commits. It consumes all old recovery codes, creates a new one-time set, revokes every session and refresh token, and appends an audit event:

```sh
SENDFLOW_ADMIN_RECOVERY_CONFIRM=I_UNDERSTAND \
  pnpm --filter @workspace/api-server run admin:recover-super-admin-mfa
```

No public email link or API bypasses MFA. The current code records recovery in the audit table; external alert delivery is not configured by this change and must be set up separately before production reliance.

## Cloudflare and origin hardening

Cloudflare configuration is external and is not active merely because the application supports assertion validation.

1. Create a Cloudflare Access application for the private administrator surface.
2. Use a default-deny policy and allow only the owner's explicitly selected identity.
3. Keep MFA enabled at the identity provider; the application still requires its own password and TOTP.
4. Set the team-domain identifier and exact Access audience in protected server settings. Enable `SENDFLOW_ADMIN_REQUIRE_CLOUDFLARE_ACCESS` only after a valid assertion succeeds and a forged/missing assertion is rejected.
5. Configure HTTPS with Full (strict) TLS, WAF, bot and DDoS protections, and firewall rules that prevent direct public origin access where hosting supports it.
6. Add a fixed business VPN/office IP only if it is stable and verified. Do not block all VPN traffic.
7. Test both the proxied entry and direct-origin denial. Keep origin and host values out of the repository and frontend bundles.

## Production checklist

- Confirm the production environment has the matching JWT key pair, TOTP encryption key, allowlisted host/origin, and verified database TLS.
- Verify the Plesk runtime's trusted proxy configuration before using forwarded client IPs.
- Confirm login failure limits, TOTP replay rejection, session expiry/revocation, refresh replay revocation, CSRF/origin rejection, and action-bound step-up in non-financial tests.
- Use a non-production database and synthetic fixtures for integration tests. Do not trigger real deposits, payouts, refunds, or balance changes as part of this security check.
- Configure an approved alert destination and test sanitized alerts before relying on incident notifications.
- Publish or deploy only after explicit approval and after the external Cloudflare/network checklist is verified.
