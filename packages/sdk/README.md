# @inferevents/sdk

Event collection SDK for [Infer](https://infer.events) — analytics designed for AI agents, not dashboards.

3KB. Zero dependencies. Auto-tracks page views, clicks, sessions, and errors out of the box.

## Install

```bash
npm install @inferevents/sdk
```

## Quick start

```typescript
import { init, track, identify } from "@inferevents/sdk";

init({
  projectId: "pk_write_...",  // your write key (safe to embed in client JS)
  autoTrack: true,            // auto-tracks page views, clicks, sessions, errors
});

// Track custom events
track("signup_completed", { plan: "pro" });

// Identify a user (links anonymous activity to a known user)
identify("user_123", { email: "alice@example.com" });
```

## API

### `init(config)`

Initialize the SDK. Must be called before other methods (events queued before init are replayed automatically).

```typescript
init({
  projectId: string;       // Required. Your write key (pk_write_...)
  endpoint?: string;       // API endpoint (default: https://api.infer.events)
  autoTrack?: boolean;     // Enable auto-tracking (default: false)
  batchSize?: number;      // Events per batch (default: 20)
  flushInterval?: number;  // Flush interval in ms (default: 10000)
  debug?: boolean;         // Console logging (default: false)
});
```

### `track(eventName, properties?)`

Track a custom event.

```typescript
track("purchase", { amount: 49.99, currency: "USD" });
track("feature_used", { feature: "export" });
```

### `identify(userId, traits?)`

Link the current anonymous user to a known user ID. All past and future events are associated with this identity.

```typescript
identify("user_123", { name: "Alice", plan: "pro" });
```

### `page(name?)`

Track a page view. Called automatically if `autoTrack: true`.

```typescript
page("Pricing");
```

### `screen(name)`

Track a screen view (React Native / mobile).

```typescript
screen("Settings");
```

### `flush()`

Manually flush the event queue. Events are batched and sent automatically, but you can force a flush.

```typescript
await flush();
```

### `reset()`

Clear the current user identity. Use on logout to start a new anonymous session.

```typescript
reset();
```

### `destroy()`

Tear down the SDK, clear timers and listeners.

## Auto-tracking

When `autoTrack: true`, the SDK automatically captures:

| Event | Trigger |
|-------|---------|
| `page_view` | Page navigation (History API) |
| `session_start` | New browser session |
| `click` | Clicks on interactive elements (buttons, links) |
| `form_submit` | Form submissions |
| `error` | Uncaught JavaScript errors |

## Context

Every event includes auto-collected context:

| Field | Source |
|-------|--------|
| `browser` | User agent |
| `os` | Parsed from UA (macOS, Windows, iOS, Android, Linux) |
| `device_type` | Mobile, Tablet, or Desktop |
| `page_url` | `window.location.href` |
| `pathname` | `window.location.pathname` |
| `referrer` | `document.referrer` |
| `locale` | `navigator.language` |
| `timezone` | `Intl.DateTimeFormat` timezone |
| `screen_width` / `screen_height` | Screen dimensions |

Server-side geo enrichment (country, city, region) is added at ingestion time.

## How it works

- Events are queued in memory and flushed every 10 seconds (or when batch size is reached)
- On page unload, queued events are sent via `fetch` with `keepalive: true`
- Unflushed events are persisted to `localStorage` and restored on next page load
- Failed sends are retried with exponential backoff
- Each event gets a UUID for deduplication (server-side `ON CONFLICT DO NOTHING`)

## License

MIT
