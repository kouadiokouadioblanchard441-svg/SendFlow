# SendFlow authentication protection with Cloudflare Turnstile

SendFlow uses the Cloudflare Turnstile **Managed** widget in the browser and
verifies every submitted token on the API server. A browser-side success alone
never authorizes sign-in, account creation, or password recovery.

## Protected actions

| Flow | API operation | Expected Turnstile action |
| --- | --- | --- |
| Sign in | `POST /api/auth/sign-in` | `login` |
| Start signup email verification | `POST /api/auth/send-otp` with `purpose: "signup"` | `signup` |
| Create an account | `POST /api/auth/register` | `signup` |
| Start password recovery | `POST /api/auth/send-otp` with `purpose: "password_reset"` | `password_reset` |
| Save a new password | `POST /api/auth/reset-password` | `password_reset` |

The password-recovery widget must be completed again before requesting a
replacement email code and before saving the new password. Signup uses a fresh
token for the initial email-code request and another for final account creation.
The separate PIN-recovery flow is unchanged.

## API contract and server checks

The protected request bodies require `turnstileToken`, a non-empty token no
longer than 2,048 characters. The server sends it to Cloudflare's official
Siteverify endpoint and requires all of the following:

- Siteverify returns `success: true`.
- The returned hostname exactly matches the trusted request origin hostname.
- The returned action exactly matches the action listed above.
- The token has not already been consumed. Cloudflare rejects expired or
  previously used tokens; SendFlow treats those responses as a failed check.

Missing or invalid tokens are rejected before account/session creation or
password changes. If the server secret is missing, Siteverify times out, or
Cloudflare is unavailable, the API fails closed and returns a generic
temporary-unavailability message. It does not log the token or secret.

The current account/rate limits remain in force. Sign-in and account creation
continue to use the existing server-side email/phone and requester buckets.
The API derives `remoteip` from Express `req.ip`; the application must keep
`TRUST_PROXY_HOPS` aligned with the actual trusted proxy chain. If no valid IP
is available, SendFlow omits `remoteip` rather than trusting a request header.

## Replit configuration

1. In Cloudflare Turnstile, create a **Managed** site key and add every exact
   SendFlow hostname that will render the widget. Production and development
   preview hostnames are separate allow-list entries. Do not use a wildcard
   unless Cloudflare's site configuration explicitly supports and requires it.
2. Add `VITE_TURNSTILE_SITE_KEY` as a shared Replit environment variable. This
   value is public and is included in the web client bundle; it is not the
   verification secret.
3. Add `TURNSTILE_SECRET_KEY` through Replit Secrets for the API server only.
   Never add the secret to a `VITE_` variable, a frontend file, or a committed
   environment file.
4. Confirm `CORS_ALLOWED_ORIGINS` contains the exact production web origins.
   Preview origins must be present in the SendFlow preview origin policy, and
   the Cloudflare site key must allow the corresponding hostname.
5. Restart the API and web workflows after changing environment values. Build
   the web client again after changing the public site key.

If the public site key is absent, the widget displays a configuration error and
keeps the affected submit buttons disabled. If the server secret is absent,
direct API calls are rejected; there is no development or production bypass.

## Verification performed in the repository

Automated tests use an isolated API database and mocked Siteverify responses.
They cover accepted tokens, missing and rejected tokens, a consumed token,
hostname/action mismatch, server configuration failure, and Siteverify
unavailability. No Cloudflare account key or live verification request is used
by the test suite. The configured site key and hostname allow-list still need to
be supplied and confirmed in Replit/Cloudflare before a real browser challenge
can be exercised.
