# Local setup

## Requirements

- Node.js 22.12 or newer
- Bun 1.4.0
- A Convex account and development deployment
- Twitch developer credentials for Twitch features
- Resend credentials for email verification
- Dodo Payments credentials only if testing checkout
- Cloudflare R2 credentials only if testing clip downloads

## Install and configure

```sh
git clone https://github.com/evonera/streamhuddle.git
cd streamhuddle
bun install
bun run setup
bun run dev
```

The setup command removes installed dependencies, lockfiles, generated files, and build output before reinstalling and configuring Convex. It preserves `.env.local` by default and reconnects to its configured deployment. Use it for a fresh clone or to repair a broken setup, not for routine environment changes. `bun run setup --fresh` also removes `.env.local` and provisions a new Convex deployment.

For a local Convex backend, run `bun run setup:local`. Review the prompts before confirming any backend or credential changes.

Open `http://localhost:3000` after setup. Use `bun run convex:env` to inspect the development deployment variables and `npx convex env set NAME VALUE` to change one. Use the `--prod` flag only when intentionally changing the production deployment.

See [ENV.md](ENV.md) for the variable inventory and [DEPLOY.md](DEPLOY.md) for Cloudflare Pages configuration.
