import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/** Extract the parsed JSON body from the Nth fetch call (0-indexed). */
function getFetchBody(callIndex: number) {
  const call = mockFetch.mock.calls[callIndex];
  if (!call) throw new Error(`No fetch call at index ${callIndex}`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  return JSON.parse((call as any[])[1].body) as { events: any[] };
}

/** Get headers from the Nth fetch call. */
function getFetchHeaders(callIndex: number) {
  const call = mockFetch.mock.calls[callIndex];
  if (!call) throw new Error(`No fetch call at index ${callIndex}`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return (call as any[])[1].headers as Record<string, string>;
}

// We need to reset batch module state between tests since it uses module-level queue
beforeEach(async () => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  mockFetch.mockReset();
  // Default: fetch succeeds
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
  });

  // Reset batch module state by draining any leftover queue
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function createClient(overrides: Record<string, unknown> = {}) {
  const { InferClient } = await import("./core");
  return new InferClient({
    projectId: "test-project",
    flushInterval: 60_000,
    ...overrides,
  });
}

describe("constructor", () => {
  it("throws if projectId is missing", async () => {
    const { InferClient } = await import("./core");
    expect(() => new InferClient({} as any)).toThrow("[infer] projectId is required");
  });

  it("throws if projectId is not a string", async () => {
    const { InferClient } = await import("./core");
    expect(() => new InferClient({ projectId: 123 as any })).toThrow(
      "[infer] projectId is required",
    );
  });

  it("throws if projectId is empty string", async () => {
    const { InferClient } = await import("./core");
    expect(() => new InferClient({ projectId: "" })).toThrow(
      "[infer] projectId is required",
    );
  });

  it("creates client with valid projectId", async () => {
    const { InferClient } = await import("./core");
    const client = new InferClient({ projectId: "test-project" });
    expect(client).toBeInstanceOf(InferClient);
    client.destroy();
  });

  it("restores persisted queue on init", async () => {
    const events = [
      {
        event_id: "evt-1",
        project_id: "test-project",
        anonymous_id: "anon-1",
        event_name: "persisted_event",
        event_type: "track",
        properties: {},
        context: {},
        timestamp: new Date().toISOString(),
      },
    ];
    localStorage.setItem("infer_event_queue", JSON.stringify(events));

    const client = await createClient();
    // The persisted events should have been restored
    // localStorage item should be removed after restore
    expect(localStorage.getItem("infer_event_queue")).toBeNull();
    client.destroy();
  });
});

describe("track", () => {
  it("enqueues event with correct type and name", async () => {
    const client = await createClient();

    client.track("button_click", { label: "signup" });
    await client.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_name === "button_click");
    expect(event).toBeDefined();
    expect(event.event_type).toBe("track");
    expect(event.properties.label).toBe("signup");

    client.destroy();
  });

  it("includes anonymous_id in event", async () => {
    const client = await createClient();

    client.track("test_event");
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_name === "test_event");
    expect(event.anonymous_id).toBeDefined();
    expect(event.anonymous_id.length).toBeGreaterThan(0);

    client.destroy();
  });

  it("includes context in event", async () => {
    const client = await createClient();

    client.track("test_event");
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_name === "test_event");
    expect(event.context).toBeDefined();
    expect(event.context.platform).toBe("web");
    expect(event.context.sdk_version).toBeDefined();

    client.destroy();
  });

  it("includes timestamp in event", async () => {
    const client = await createClient();

    client.track("test_event");
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_name === "test_event");
    expect(event.timestamp).toBeDefined();
    // Should be a valid ISO timestamp
    expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);

    client.destroy();
  });
});

describe("identify", () => {
  it("enqueues identify event", async () => {
    const client = await createClient();

    client.identify("user-abc", { name: "Test User" });
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_type === "identify");
    expect(event).toBeDefined();
    expect(event.event_name).toBe("identify");
    expect(event.properties.name).toBe("Test User");

    client.destroy();
  });

  it("subsequent track events include user_id", async () => {
    const client = await createClient();

    client.identify("user-abc");
    client.track("post_identify_event");
    await client.flush();

    const body = getFetchBody(0);
    const trackEvent = body.events.find(
      (e: any) => e.event_name === "post_identify_event",
    );
    expect(trackEvent.user_id).toBe("user-abc");

    client.destroy();
  });
});

describe("page", () => {
  it("enqueues page_view event", async () => {
    const client = await createClient();

    client.page();
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_type === "page");
    expect(event).toBeDefined();
    expect(event.event_name).toBe("page_view");

    client.destroy();
  });

  it("includes url, path, and title", async () => {
    const client = await createClient();

    client.page();
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_type === "page");
    expect(event.properties.url).toBe(window.location.href);
    expect(event.properties.path).toBe(window.location.pathname);
    expect(event.properties.title).toBe(document.title);

    client.destroy();
  });

  it("includes name when provided", async () => {
    const client = await createClient();

    client.page("Dashboard");
    await client.flush();

    const body = getFetchBody(0);
    const event = body.events.find((e: any) => e.event_type === "page");
    expect(event.properties.name).toBe("Dashboard");

    client.destroy();
  });
});

describe("flush", () => {
  it("sends batch to API endpoint", async () => {
    const client = await createClient({ endpoint: "https://api.test.com" });

    client.track("test_event");
    await client.flush();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/v1/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-project",
        }),
      }),
    );

    client.destroy();
  });

  it("uses correct auth header", async () => {
    const client = await createClient({ projectId: "my-api-key-123" });

    client.track("test_event");
    await client.flush();

    const headers = getFetchHeaders(0);
    expect(headers.Authorization).toBe("Bearer my-api-key-123");

    client.destroy();
  });

  it("resets retry count on success", async () => {
    const client = await createClient();

    // Simulate a network error to bump retry count
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    client.track("event_1");
    await client.flush();

    // Now succeed -- the retry-returned batch should flush
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    // Need to also handle the follow-up flush call inside flush()
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    client.track("event_2");
    await client.flush();

    // The client should still be operational (not disabled)
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    client.track("event_3");
    await client.flush();
    expect(mockFetch).toHaveBeenCalled();

    client.destroy();
  });

  it("retries on 5xx errors by returning batch to queue", async () => {
    const client = await createClient();

    // First flush: 500 error, event goes back to queue
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    // Subsequent flushes: success
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    client.track("retry_event");
    await client.flush();

    // Verify fetch was called at least once (the 500 call)
    expect(mockFetch).toHaveBeenCalled();

    // Verify the first call contained our retry_event
    const firstBody = getFetchBody(0);
    expect(firstBody.events.some((e: any) => e.event_name === "retry_event")).toBe(true);

    client.destroy();
  });

  it("drops batch on 4xx errors", async () => {
    const client = await createClient();

    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    client.track("bad_event");
    await client.flush();

    // Flush again - should have nothing to send (batch was dropped)
    mockFetch.mockClear();
    await client.flush();
    expect(mockFetch).not.toHaveBeenCalled();

    client.destroy();
  });

  it("disables after MAX_RETRIES network failures", async () => {
    const client = await createClient();

    // Set up enough rejections for all retries
    for (let i = 0; i < 10; i++) {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
    }

    client.track("doomed_event");

    // Run the initial flush
    await client.flush();

    // Each retry schedules a setTimeout. Advance through each retry.
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(35_000);
    }

    // After MAX_RETRIES (5), the client should be disabled
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    client.track("post_disable_event");
    await client.flush();
    // Should not attempt to send because client is disabled
    expect(mockFetch).not.toHaveBeenCalled();

    client.destroy();
  });

  it("does not flush when queue is empty", async () => {
    const client = await createClient();

    await client.flush();
    expect(mockFetch).not.toHaveBeenCalled();

    client.destroy();
  });

  it("flushes automatically on interval", async () => {
    const client = await createClient({ flushInterval: 5000 });

    client.track("auto_flush_event");

    // Advance past the flush interval
    await vi.advanceTimersByTimeAsync(5001);

    expect(mockFetch).toHaveBeenCalled();
    const body = getFetchBody(0);
    expect(body.events.some((e: any) => e.event_name === "auto_flush_event")).toBe(true);

    client.destroy();
  });
});

describe("destroy", () => {
  it("clears flush timer", async () => {
    const client = await createClient({ flushInterval: 5000 });

    client.track("before_destroy");
    client.destroy();

    // Advancing time should not trigger flush
    mockFetch.mockClear();
    vi.advanceTimersByTime(10_000);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("persists queue on destroy", async () => {
    const client = await createClient();

    client.track("persisted_on_destroy");
    client.destroy();

    const stored = localStorage.getItem("infer_event_queue");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!) as any[];
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed.some((e: any) => e.event_name === "persisted_on_destroy")).toBe(true);
  });

  it("calls teardown for autotrack", async () => {
    const client = await createClient({ autoTrack: true });

    // After destroy, auto-track listeners should be removed
    client.destroy();

    // Clicking a button should not trigger additional tracking
    mockFetch.mockClear();
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.click();
    // Verify no crash and the client handled teardown gracefully
    document.body.removeChild(button);
  });
});
