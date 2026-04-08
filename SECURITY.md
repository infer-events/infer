# Security Policy

## Supported Versions

Only the latest published versions of each package on npm receive security updates:

| Package | Latest |
|---|---|
| `@inferevents/sdk` | 0.1.x |
| `@inferevents/mcp` | 0.5.x |
| `@inferevents/shared` | 0.1.x |

## Reporting a Vulnerability

If you discover a security vulnerability in any Infer package — or in the hosted ingestion API at `api.infer.events` or the remote MCP endpoint at `mcp.infer.events` — please **do not** file a public GitHub issue.

Instead, email **security@infer.events** with:

- A description of the vulnerability
- Steps to reproduce
- The affected package(s) and version(s)
- Your assessment of the impact

You should expect an acknowledgement within **24 hours** and a status update within **72 hours**. We will keep you informed throughout the investigation and coordinate responsible disclosure once a fix is in place.

## Scope

In scope:

- The published packages in this repository (`@inferevents/sdk`, `@inferevents/mcp`, `@inferevents/shared`)
- The hosted ingestion API (`api.infer.events`)
- The hosted remote MCP endpoint (`mcp.infer.events`)
- The marketing site (`infer.events`)

Out of scope:

- Reports based solely on outdated dependencies (please open a normal issue or PR instead)
- Self-XSS, clickjacking on pages with no sensitive actions, or theoretical issues without a working PoC
- Rate-limiting or volumetric DoS

## What We Collect

The SDK in this repository collects analytics events from your application and sends them to `api.infer.events`. It is designed to:

- Send only the events you explicitly track, plus opt-in auto-tracked events (page views, clicks, form submits, errors)
- Respect Do Not Track headers
- Never collect personally identifiable information unless you explicitly attach it via `identify()`
- Never use third-party cookies or cross-site tracking

The full collection logic is in [`packages/sdk/src/`](./packages/sdk/src) — you can read every line of it before installing.
