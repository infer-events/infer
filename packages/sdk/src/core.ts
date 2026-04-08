import {
  enqueue,
  drain,
  queueSize,
  returnToQueue,
  persistQueue,
  restoreQueue,
  type QueuedEvent,
  type EventCategory,
} from "./batch";
import { buildContext } from "./context";
import { getAnonymousId, getUserId, setIdentity } from "./identity";
import { log, warn, error, setDebug } from "./logger";
import {
  resolveAutoTrackConfig,
  setupAutoTracking,
  type AutoTrackConfig,
} from "./auto-track";

export interface InferConfig {
  projectId: string;
  endpoint?: string;
  autoTrack?: boolean | Partial<AutoTrackConfig>;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
}

const DEFAULT_ENDPOINT = "https://api.infer.events";
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL = 10_000;
const MAX_RETRY_DELAY = 30_000;
const BASE_RETRY_DELAY = 1_000;
const MAX_RETRIES = 5;

export class InferClient {
  private config: Required<
    Pick<InferConfig, "projectId" | "endpoint" | "batchSize" | "flushInterval">
  >;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private teardownAutoTrack: (() => void) | null = null;
  private flushing = false;
  private retryCount = 0;
  private disabled = false;

  constructor(config: InferConfig) {
    if (!config.projectId || typeof config.projectId !== "string") {
      throw new Error("[infer] projectId is required");
    }

    setDebug(config.debug ?? false);

    this.config = {
      projectId: config.projectId,
      endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
    };

    log("Initialized with config:", this.config);

    // Restore any persisted events from previous session
    restoreQueue();

    // Set up periodic flush
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushInterval);

    // Flush on page unload
    if (typeof window !== "undefined") {
      const onUnload = (): void => {
        persistQueue();
        this.sendBeacon();
      };
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          onUnload();
        }
      });
      window.addEventListener("pagehide", onUnload);
    }

    // Set up auto-tracking
    const autoTrackConfig = resolveAutoTrackConfig(config.autoTrack ?? false);
    if (autoTrackConfig) {
      this.teardownAutoTrack = setupAutoTracking(this, autoTrackConfig);
    }
  }

  track(
    eventName: string,
    properties?: Record<string, string | number | boolean | null>,
    options?: { category?: EventCategory },
  ): void {
    this.enqueueEvent("track", eventName, properties ?? {}, options?.category);
  }

  identify(
    newUserId: string,
    traits?: Record<string, string | number | boolean | null>,
  ): void {
    setIdentity(newUserId, traits);
    this.enqueueEvent("identify", "identify", traits ?? {});
  }

  page(name?: string): void {
    const properties: Record<string, string | number | boolean | null> = {};
    if (name) properties.name = name;

    if (typeof window !== "undefined") {
      properties.url = window.location.href;
      properties.path = window.location.pathname;
      properties.title = document.title;
    }

    this.enqueueEvent("page", "page_view", properties);
  }

  screen(name: string): void {
    this.enqueueEvent("screen", "screen_view", { name });
  }

  /** Internal method for auto-tracking — do not use directly. */
  trackInternal(
    eventName: string,
    properties: Record<string, string | number | boolean | null>,
  ): void {
    this.enqueueEvent("track", eventName, properties);
  }

  async flush(): Promise<void> {
    if (this.disabled || this.flushing || queueSize() === 0) return;
    this.flushing = true;

    const batch = drain(this.config.batchSize);
    log(`Flushing ${batch.length} events`);

    try {
      const res = await fetch(`${this.config.endpoint}/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.projectId}`,
        },
        body: JSON.stringify({ events: batch }),
      });

      if (res.ok) {
        this.retryCount = 0;
        log(`Flushed ${batch.length} events successfully`);
      } else if (res.status >= 500) {
        // Server error — retry
        warn(`Server error ${res.status}, will retry`);
        returnToQueue(batch);
        this.scheduleRetry();
      } else {
        // Client error (4xx) — don't retry, events are malformed
        error(`Client error ${res.status}, dropping batch`);
      }
    } catch (err) {
      if (this.retryCount >= MAX_RETRIES) {
        error(
          `Cannot connect to ${this.config.endpoint} after ${MAX_RETRIES} attempts. ` +
          `If your site uses a Content Security Policy, add ${this.config.endpoint} to connect-src. ` +
          `Events will be dropped until the page is reloaded.`
        );
        this.disabled = true;
        return;
      }
      warn("Network error, will retry:", err);
      returnToQueue(batch);
      this.scheduleRetry();
    } finally {
      this.flushing = false;
    }

    // If there are more events, flush again
    if (queueSize() > 0) {
      void this.flush();
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.teardownAutoTrack) {
      this.teardownAutoTrack();
      this.teardownAutoTrack = null;
    }
    persistQueue();
  }

  private enqueueEvent(
    eventType: "track" | "identify" | "page" | "screen",
    eventName: string,
    properties: Record<string, string | number | boolean | null>,
    category?: EventCategory,
  ): void {
    const event: QueuedEvent = {
      event_id: crypto.randomUUID(),
      project_id: this.config.projectId,
      anonymous_id: getAnonymousId(),
      event_name: eventName,
      event_type: eventType,
      properties,
      context: buildContext() as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    };

    if (category) {
      event.category = category;
    }

    const uid = getUserId();
    if (uid) {
      event.user_id = uid;
    }

    enqueue(event);

    // Flush immediately if batch size is reached
    if (queueSize() >= this.config.batchSize) {
      void this.flush();
    }
  }

  private sendBeacon(): void {
    const batch = drain(this.config.batchSize);
    if (batch.length === 0) return;

    try {
      // Use fetch with keepalive instead of sendBeacon (sendBeacon can't set auth headers)
      fetch(`${this.config.endpoint}/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.projectId}`,
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      }).then((res) => {
        if (res.ok) {
          log(`Beacon sent ${batch.length} events`);
        } else {
          returnToQueue(batch);
          persistQueue();
        }
      }).catch(() => {
        returnToQueue(batch);
        persistQueue();
      });
    } catch {
      returnToQueue(batch);
      persistQueue();
    }
  }

  private scheduleRetry(): void {
    this.retryCount++;
    const delay = Math.min(
      BASE_RETRY_DELAY * Math.pow(2, this.retryCount - 1) +
        Math.random() * 1000,
      MAX_RETRY_DELAY,
    );
    log(`Retry #${this.retryCount} in ${Math.round(delay)}ms`);
    setTimeout(() => void this.flush(), delay);
  }
}
