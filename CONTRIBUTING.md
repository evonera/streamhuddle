# Contributing

Thanks for helping improve StreamHuddle. For substantial changes, open an issue first so the expected behavior is clear.

## Development setup

Use Node.js 22.12 or newer and Bun 1.4.0. Start with the [local setup guide](docs/SETUP.md); it explains the required Convex services and environment variables.

```sh
bun install
bun run dev
```

Before opening a pull request, run the checks that apply to your changes:

```sh
bun run typecheck
bun run test
bun run build
```

UI changes should follow [DESIGN.md](DESIGN.md). Backend changes must follow the Convex guidance in `convex/_generated/ai/guidelines.md`.

## Pull requests

- Keep changes focused and describe the user-visible effect.
- Add or update tests for behavior changes and security fixes.
- Include screenshots for visible interface changes when practical.
- Do not commit `.env.local`, credentials, production API keys, or user data.
- Call out any deployment variables, Convex migrations, or manual dashboard changes required.
- Confirm the pull request checks pass before requesting review.

## Issues

Use the issue templates for bugs and feature requests. Do not report security vulnerabilities in public issues; follow [SECURITY.md](SECURITY.md).
