import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { QueuedEvent } from "./batch";

function makeEvent(overrides: Partial<QueuedEvent> = {}): QueuedEvent {
  return {
    event_id: crypto.randomUUID(),
    project_id: "test-project",
    anonymous_id: "anon-123",
    event_name: overrides.event_name ?? "test_event",
    event_type: overrides.event_type ?? "track",
    properties: overrides.properties ?? {},
    context: overrides.context ?? {},
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enqueue", () => {
  it("adds event to queue", async () => {
    const { enqueue, queueSize } = await import("./batch");
    const event = makeEvent();
    enqueue(event);
    expect(queueSize()).toBe(1);
  });

  it("drops oldest when queue full (1000 max)", async () => {
    const { enqueue, queueSize, drain } = await import("./batch");

    // Fill to capacity
    for (let i = 0; i < 1000; i++) {
      enqueue(makeEvent({ event_name: `event_${i}` }));
    }
    expect(queueSize()).toBe(1000);

    // Adding one more should drop the oldest
    enqueue(makeEvent({ event_name: "event_overflow" }));
    expect(queueSize()).toBe(1000);

    // The first event should be event_1 (event_0 was dropped)
    const allEvents = drain(1000);
    expect(allEvents[0]!.event_name).toBe("event_1");
    expect(allEvents[allEvents.length - 1]!.event_name).toBe("event_overflow");
  });
});

describe("drain", () => {
  it("removes and returns batch of specified size", async () => {
    const { enqueue, drain, queueSize } = await import("./batch");

    for (let i = 0; i < 10; i++) {
      enqueue(makeEvent({ event_name: `event_${i}` }));
    }

    const batch = drain(5);
    expect(batch).toHaveLength(5);
    expect(queueSize()).toBe(5);
    expect(batch[0]!.event_name).toBe("event_0");
    expect(batch[4]!.event_name).toBe("event_4");
  });

  it("returns empty array when queue is empty", async () => {
    const { drain } = await import("./batch");
    const batch = drain(10);
    expect(batch).toEqual([]);
  });

  it("returns partial batch when fewer events than batch size", async () => {
    const { enqueue, drain } = await import("./batch");

    enqueue(makeEvent({ event_name: "only_one" }));
    enqueue(makeEvent({ event_name: "only_two" }));

    const batch = drain(10);
    expect(batch).toHaveLength(2);
    expect(batch[0]!.event_name).toBe("only_one");
    expect(batch[1]!.event_name).toBe("only_two");
  });
});

describe("queueSize", () => {
  it("returns 0 for empty queue", async () => {
    const { queueSize } = await import("./batch");
    expect(queueSize()).toBe(0);
  });

  it("returns correct count after enqueuing", async () => {
    const { enqueue, queueSize } = await import("./batch");
    enqueue(makeEvent());
    enqueue(makeEvent());
    enqueue(makeEvent());
    expect(queueSize()).toBe(3);
  });
});

describe("returnToQueue", () => {
  it("prepends events back to front of queue", async () => {
    const { enqueue, drain, returnToQueue } = await import("./batch");

    enqueue(makeEvent({ event_name: "existing_1" }));
    enqueue(makeEvent({ event_name: "existing_2" }));

    const failed = [
      makeEvent({ event_name: "failed_1" }),
      makeEvent({ event_name: "failed_2" }),
    ];

    returnToQueue(failed);

    const all = drain(10);
    expect(all[0]!.event_name).toBe("failed_1");
    expect(all[1]!.event_name).toBe("failed_2");
    expect(all[2]!.event_name).toBe("existing_1");
    expect(all[3]!.event_name).toBe("existing_2");
  });

  it("enforces max size after re-adding", async () => {
    const { enqueue, queueSize, returnToQueue } = await import("./batch");

    // Fill to 999
    for (let i = 0; i < 999; i++) {
      enqueue(makeEvent());
    }

    // Return 5 events to front — total would be 1004, should truncate to 1000
    const failed = Array.from({ length: 5 }, () => makeEvent());
    returnToQueue(failed);

    expect(queueSize()).toBe(1000);
  });
});

describe("persistQueue", () => {
  it("persists to localStorage key 'infer_event_queue'", async () => {
    const { enqueue, persistQueue } = await import("./batch");

    enqueue(makeEvent({ event_name: "persisted" }));
    persistQueue();

    const stored = localStorage.getItem("infer_event_queue");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as QueuedEvent[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.event_name).toBe("persisted");
  });

  it("does nothing when queue is empty", async () => {
    const { persistQueue } = await import("./batch");
    persistQueue();
    expect(localStorage.getItem("infer_event_queue")).toBeNull();
  });

  it("does nothing when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { enqueue, persistQueue } = await import("./batch");
    enqueue(makeEvent());
    // Should not throw
    expect(() => persistQueue()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("restoreQueue", () => {
  it("restores from localStorage on call", async () => {
    const events = [
      makeEvent({ event_name: "restored_1" }),
      makeEvent({ event_name: "restored_2" }),
    ];
    localStorage.setItem("infer_event_queue", JSON.stringify(events));

    const { restoreQueue, queueSize, drain } = await import("./batch");
    restoreQueue();

    expect(queueSize()).toBe(2);
    const all = drain(10);
    expect(all[0]!.event_name).toBe("restored_1");
    expect(all[1]!.event_name).toBe("restored_2");
  });

  it("removes localStorage item after restore", async () => {
    localStorage.setItem(
      "infer_event_queue",
      JSON.stringify([makeEvent()]),
    );

    const { restoreQueue } = await import("./batch");
    restoreQueue();

    expect(localStorage.getItem("infer_event_queue")).toBeNull();
  });

  it("handles corrupted data gracefully", async () => {
    localStorage.setItem("infer_event_queue", "not valid json{{{");

    const { restoreQueue, queueSize } = await import("./batch");
    expect(() => restoreQueue()).not.toThrow();
    expect(queueSize()).toBe(0);
  });

  it("does nothing when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { restoreQueue, queueSize } = await import("./batch");
    expect(() => restoreQueue()).not.toThrow();
    expect(queueSize()).toBe(0);
    vi.unstubAllGlobals();
  });

  it("merges restored events with existing queue", async () => {
    localStorage.setItem(
      "infer_event_queue",
      JSON.stringify([makeEvent({ event_name: "restored" })]),
    );

    const { enqueue, restoreQueue, drain } = await import("./batch");
    enqueue(makeEvent({ event_name: "existing" }));
    restoreQueue();

    const all = drain(10);
    // Restored events are prepended
    expect(all[0]!.event_name).toBe("restored");
    expect(all[1]!.event_name).toBe("existing");
  });
});
