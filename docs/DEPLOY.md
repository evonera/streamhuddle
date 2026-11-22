# Cloudflare Pages deployment

The supported deployment target is Cloudflare Pages. The build command is `bun run build`, the output directory is `dist`, and the project expects Node.js 22.12+ and Bun 1.4.0. `wrangler.json` contains the Pages output configuration.

## Build variables

Cloudflare Pages must expose these variables during the build, separately in Preview and Production settings:

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL` or `CONVEX_DEPLOYMENT`
- `SITE_URL` or `VITE_SITE_URL`
- Set both `SITE_URL` and `VITE_SITE_URL` to the same canonical origin.

The Preview environment should point to a non-production Convex deployment. Configure its canonical origin to the stable branch preview hostname you intend to use. Production should point to the production Convex deployment and public app origin. The production build intentionally fails when its canonical site URL is absent.

Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` on Convex; they power live-status polling, streamer pages, and "Continue with Twitch" sign-in. Cloudflare Pages no longer needs Twitch variables. Register each environment's Better Auth callback, `${SITE_URL}/api/auth/callback/twitch`, with Twitch.

## Convex configuration

Set the matching `SITE_URL` on Convex. Add `TRUSTED_ORIGINS` only for additional frontend origins that should be allowed to call the backend. Configure auth, mail, Twitch, and payments variables (plus R2 until the clip-creation teardown has run) from [ENV.md](ENV.md). Keep secrets in Convex, never in `wrangler.json`, source files, or `VITE_*` variables.

Register the production and preview Twitch callback URLs only when those environments need Twitch OAuth. Use test-mode Dodo credentials and a development Convex backend for previews.

## Release checks

Run `bun run typecheck`, `bun run test`, and `bun run build`. Check the Cloudflare Pages build logs for the exact deployment environment and commit when a Pages check fails. A successful GitHub Actions build does not prove that Cloudflare's separate Preview variables are configured.
