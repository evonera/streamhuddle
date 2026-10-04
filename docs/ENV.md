# Environment variables

Keep secrets on the server. Values prefixed with `VITE_` are substituted into client or server build output and must be treated as public. Never put API keys, OAuth client secrets, webhook secrets, or storage credentials in a `VITE_*` variable.

## Build and browser configuration

Set these in `.env.local` for development and in the Cloudflare Pages build environment for deployed builds.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_CONVEX_URL` | Yes | Public URL of the Convex deployment used by the browser. |
| `VITE_CONVEX_SITE_URL` | Yes | Public Convex HTTP URL used by Better Auth. Can be derived from `CONVEX_DEPLOYMENT` by the Vite config. |
| `SITE_URL` | Yes for production | Canonical application origin used by Convex for auth links and payment return URLs. |
| `VITE_SITE_URL` | Yes for production | Canonical origin used by frontend metadata and the sitemap. Keep it equal to `SITE_URL`. |
| `CONVEX_DEPLOYMENT` | Development convenience | Convex CLI deployment selector; Vite can derive the `.convex.site` URL from it. |
| `ANALYZE` | No | Set to `1` to write a bundle visualization during a Vite build. |

Cloudflare Pages needs the public values available to the **build** environment. Runtime bindings alone are not enough. Configure Preview and Production separately. A Preview deployment should use a development Convex backend and a deliberate preview origin; do not point an untrusted preview at production data.

## Cloudflare Pages runtime variables

Set these in the Pages runtime environment for each environment that supports Twitch OAuth:

| Variable | Required | Purpose |
| --- | --- | --- |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Required for Twitch integration | OAuth credentials used by the Twitch OAuth routes. Keep the secret in a Cloudflare secret binding. |
| `TWITCH_REDIRECT_BASE_URL` | Required for Twitch OAuth | Fixed origin for `/api/twitch/callback`; normally the same origin configured as `SITE_URL`. |

## Convex server variables

Set these on the Convex deployment using `bun run convex:env` or the Convex dashboard. Keep the development and production values separate.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SITE_URL` | Yes | Canonical app origin for Better Auth, CORS, OAuth redirects, and payment returns. |
| `TRUSTED_ORIGINS` | No | Comma-separated extra allowed origins for a deliberate multi-host deployment. |
| `BETTER_AUTH_SECRET` | Yes | Secret used by Better Auth. Use a unique random value per deployment. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in credentials. |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Required for Twitch integration | Twitch app credentials used by Convex API actions and sign-in. The same credentials are also used by Cloudflare Pages OAuth routes. Keep the secret server-side in both environments. |
| `RESEND_API_KEY` | Required for email delivery | Resend API key. |
| `RESEND_WEBHOOK_SECRET` | Recommended | Verifies Resend delivery-event webhooks. |
| `RESEND_TEST_MODE` | No | Defaults to test mode. Set to `false` only when production email is configured. |
| `EMAIL_FROM` | No | Verified sender address. Defaults to Resend's onboarding sender. |
| `APP_NAME` | No | App name used in email copy. |
| `DODO_PAYMENTS_API_KEY` | Required for checkout and billing portal | Dodo API key. Use test credentials for development. |
| `DODO_PAYMENTS_ENVIRONMENT` | Required for live billing | `test_mode` or `live_mode`; the code defaults to test mode. |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Required for payment webhooks | Dodo webhook signing secret. |
| `DODO_PRO_PRODUCT_ID` | Required for checkout | Product identifier for the one-time Lifetime Pro purchase in the selected Dodo environment. |
| `YOUTUBE_API_KEY` | Optional | Enables YouTube upcoming-event lookups. |
| `KICK_PROXY_URL` | Optional | HTTPS URL of a compatible Kick proxy. |
| `TRUSTED_PROXY` | Optional | Set to `true` only when requests arrive through a trusted proxy that sets the expected client IP headers. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Required for clip file storage | Cloudflare R2 credentials. Keep all three server-side. |

Register the callback URI `${TWITCH_REDIRECT_BASE_URL}/api/twitch/callback` with Twitch. Do not use a request's Host header to construct an OAuth redirect.

Use [.env.example](../.env.example) and [.env.convex.example](../.env.convex.example) as key lists. They contain placeholders, not credentials.
