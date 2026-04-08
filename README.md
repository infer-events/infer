# Infer

**Analytics for your AI, not AI for your analytics.**

Infer is event analytics designed for AI agents, not dashboards. You ship the SDK, your agent gets a Model Context Protocol (MCP) server with five query tools and hourly auto-detected insights. No charts. No funnels. No SQL builder. Your agent does the analysis.

→ [infer.events](https://infer.events) · [Get an API key](https://infer.events/signup)

---

## What's in this repository

This is the public source for the three client packages that run in your application and your agent. They are MIT-licensed and the same code you get from npm.

| Package | Description | npm |
|---|---|---|
| [`@inferevents/sdk`](./packages/sdk) | Event collection SDK. ~3KB, zero dependencies. Auto-tracks page views, clicks, sessions, and errors. Works in browsers, Node, edge runtimes. | [![npm](https://img.shields.io/npm/v/@inferevents/sdk.svg)](https://www.npmjs.com/package/@inferevents/sdk) |
| [`@inferevents/mcp`](./packages/mcp) | MCP server with 12 tools — query events, fetch insights, manage projects, annotate threads. Runs locally via stdio (`npx @inferevents/mcp`) or as a hosted Streamable HTTP endpoint at `mcp.infer.events`. | [![npm](https://img.shields.io/npm/v/@inferevents/mcp.svg)](https://www.npmjs.com/package/@inferevents/mcp) |
| [`@inferevents/shared`](./packages/shared) | Shared types and Zod schemas. Used by both SDK and MCP. | [![npm](https://img.shields.io/npm/v/@inferevents/shared.svg)](https://www.npmjs.com/package/@inferevents/shared) |

## What's *not* in this repository

The hosted ingestion API at `api.infer.events` (event ingestion, query routing, insight detection cron, auth) is closed-source. We open-source the client packages because:

1. The SDK runs in your customer's users' browsers — you should be able to read every line before shipping it.
2. The MCP server runs as a tool inside your agent — you should know exactly what data it can fetch and what it sends back.
3. The schemas and types in `shared` are needed for type-safe integration in your own code.

The server is closed because the insight detection logic is the IP that makes Infer worth using. If you need self-hosted, [get in touch](mailto:hello@infer.events).

## Quick start

### 1. Install the SDK in your app

```bash
npm install @inferevents/sdk
```

```ts
import { createClient } from "@inferevents/sdk";

const infer = await createClient({
  apiKey: "pk_write_..." // get one at infer.events/signup
});

// Auto-tracking starts immediately. Or send custom events:
await infer.track("checkout_completed", { plan: "pro", amount: 49 });
```

### 2. Add the MCP server to your agent

For Claude Code, Cursor, Zed, or any MCP client — add to your config:

```json
{
  "mcpServers": {
    "infer": {
      "command": "npx",
      "args": ["-y", "@inferevents/mcp"],
      "env": {
        "INFER_API_KEY": "pk_read_..."
      }
    }
  }
}
```

Or use the hosted Streamable HTTP endpoint at `https://mcp.infer.events/mcp` (point your MCP client at it with the same `pk_read_*` key in the `Authorization` header).

Your agent now has tools like `get_top_events`, `get_retention`, `get_insights`, and can act on findings without you ever opening a dashboard.

## Architecture

```
                                                                                  
   Your app                       api.infer.events             Your agent          
                                  (closed source)                                  
   ┌──────────────────┐           ┌─────────────────┐         ┌──────────────────┐
   │ @inferevents/sdk │  events   │ Ingestion API   │         │ @inferevents/mcp │
   │ ─────────────── ├──────────►│ ──────────────  │         │ ─────────────── ◄┤
   │  ~3KB, no deps   │           │ Hono on CF      │         │ stdio or HTTP    │
   │  auto-track      │           │ Workers + Neon  │         │ 12 tools         │
   └──────────────────┘           │ + hourly cron   │ queries └────────┬─────────┘
                                  │ for insights    │◄─────────────────┘          
                                  └─────────────────┘                             
                                                                                  
```

The SDK batches events client-side and POSTs them to `api.infer.events`. The MCP server (running locally as a stdio process or remotely as a Cloudflare Worker at `mcp.infer.events`) calls the same API to fetch query results, insights, and project data.

You write `pk_write_*` keys into your app, `pk_read_*` keys into your agent. Both are SHA-256 hashed at rest and routed by prefix.

## Development

```bash
git clone https://github.com/infer-events/infer.git
cd infer
npm install
npm run build      # builds all three packages via Turbo
npm run test       # runs the full test suite
npm run typecheck  # strict TS check across all packages
```

## Security

See [SECURITY.md](./SECURITY.md). To report a vulnerability, email **security@infer.events** — please do not open a public issue.

## License

MIT. See [LICENSE](./LICENSE).
