import { InferClient, type InferConfig } from "./core";
import type { QueuedEvent, EventCategory } from "./batch";
import type { AutoTrackConfig } from "./auto-track";

let client: InferClient | null = null;

// Pre-init buffer: events queued before init() is called
let preInitBuffer: Array<
  | { type: "track"; args: [string, Record<string, string | number | boolean | null>?, { category?: EventCategory }?] }
  | { type: "identify"; args: [string, Record<string, string | number | boolean | null>?] }
  | { type: "page"; args: [string?] }
  | { type: "screen"; args: [string] }
> = [];

/**
 * Initialize the Infer SDK. Must be called before tracking events.
 * Events queued before init() will be replayed automatically.
 */
export function init(config: InferConfig): InferClient {
  if (client) {
    client.destroy();
  }
  client = new InferClient(config);

  // Replay buffered events
  for (const entry of preInitBuffer) {
    switch (entry.type) {
      case "track":
        client.track(...entry.args);
        break;
      case "identify":
        client.identify(...entry.args);
        break;
      case "page":
        client.page(...entry.args);
        break;
      case "screen":
        client.screen(...entry.args);
        break;
    }
  }
  preInitBuffer = [];

  return client;
}

/**
 * Track a custom event. Optionally tag with an ontology category.
 */
export function track(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>,
  options?: { category?: EventCategory },
): void {
  if (!client) {
    preInitBuffer.push({ type: "track", args: [eventName, properties, options] });
    return;
  }
  client.track(eventName, properties, options);
}

/**
 * Identify a user and link to anonymous_id.
 */
export function identify(
  userId: string,
  traits?: Record<string, string | number | boolean | null>,
): void {
  if (!client) {
    preInitBuffer.push({ type: "identify", args: [userId, traits] });
    return;
  }
  client.identify(userId, traits);
}

/**
 * Track a page view. Optionally provide a page name.
 */
export function page(name?: string): void {
  if (!client) {
    preInitBuffer.push({ type: "page", args: [name] });
    return;
  }
  client.page(name);
}

/**
 * Track a screen view (for React Native / mobile).
 */
export function screen(name: string): void {
  if (!client) {
    preInitBuffer.push({ type: "screen", args: [name] });
    return;
  }
  client.screen(name);
}

/**
 * Manually flush the event queue.
 */
export async function flush(): Promise<void> {
  if (!client) return;
  await client.flush();
}

/**
 * Destroy the client and clean up timers/listeners.
 */
export function destroy(): void {
  if (!client) return;
  client.destroy();
  client = null;
}

/**
 * Reset identity (anonymous_id + user_id). Useful on logout.
 */
export { resetIdentity as reset } from "./identity";

// Re-export types
export type { InferConfig, InferClient } from "./core";
export type { QueuedEvent, EventCategory };
export type { AutoTrackConfig };
