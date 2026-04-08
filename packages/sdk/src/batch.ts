import { log, warn } from "./logger";

const PERSIST_KEY = "infer_event_queue";
const MAX_QUEUE_SIZE = 1000;

export type EventCategory = "activation" | "engagement" | "monetization" | "referral" | "noise";

export interface QueuedEvent {
  event_id: string;
  project_id: string;
  user_id?: string;
  anonymous_id: string;
  event_name: string;
  event_type: "track" | "identify" | "page" | "screen";
  properties: Record<string, string | number | boolean | null>;
  context: Record<string, unknown>;
  timestamp: string;
  category?: EventCategory;
}

let queue: QueuedEvent[] = [];

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function enqueue(event: QueuedEvent): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    warn("Queue full, dropping oldest event");
    queue.shift();
  }
  queue.push(event);
  log(`Queued event: ${event.event_name} (${queue.length} in queue)`);
}

export function drain(batchSize: number): QueuedEvent[] {
  const batch = queue.splice(0, batchSize);
  return batch;
}

export function queueSize(): number {
  return queue.length;
}

export function returnToQueue(events: QueuedEvent[]): void {
  // Prepend failed events back to the front
  queue = [...events, ...queue];
  // Enforce max size after re-adding
  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
  }
}

export function persistQueue(): void {
  const storage = getStorage();
  if (!storage || queue.length === 0) return;
  try {
    storage.setItem(PERSIST_KEY, JSON.stringify(queue));
    log("Persisted queue to localStorage:", queue.length);
  } catch {
    // Storage full — drop silently
  }
}

export function restoreQueue(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(PERSIST_KEY);
    if (raw) {
      const restored = JSON.parse(raw) as QueuedEvent[];
      if (Array.isArray(restored)) {
        queue = [...restored, ...queue];
        if (queue.length > MAX_QUEUE_SIZE) {
          queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
        }
        log("Restored queue from localStorage:", restored.length);
      }
      storage.removeItem(PERSIST_KEY);
    }
  } catch {
    // Corrupted data — ignore
  }
}
