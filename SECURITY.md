# Security Policy

## System and scope

StreamHuddle is a web application deployed on Cloudflare Pages with a Convex backend. This policy covers the browser application, TanStack Start server routes, Convex functions and HTTP endpoints, authentication, Twitch OAuth, clip processing and storage, and Dodo Payments webhook handling.

## Trust boundaries and security expectations

- Treat browser input, public API requests, provider callbacks, uploaded files, and remote media as untrusted.
- Enforce authentication and ownership in Convex functions; route guards in the browser are not authorization controls.
- Keep OAuth tokens, signing keys, payment API keys, and mail credentials in server-side environment variables. `VITE_*` values are public build configuration.
- Verify provider webhooks before applying account or payment changes.
- Bound work and downloaded data initiated by public callers.

## Reporting a vulnerability

Please report security issues through the repository's [Security page](https://github.com/evonera/streamhuddle/security), using private vulnerability reporting when GitHub offers it. Do not open a public issue or include credentials, personal data, or exploit material in a public discussion. If private reporting is unavailable, contact the repository maintainers through GitHub before sharing technical details.

Include the affected area, impact, steps to reproduce, and any suggested mitigation. The maintainers will respond through GitHub when they can review the report.

## Scope notes

No vulnerability class is excluded from review. Reports about third-party services should identify the StreamHuddle behavior that exposes or mishandles data; vulnerabilities confined to a provider should be sent to that provider as well.
