import { describe, it, expect, vi } from "vitest";
import { handleListSpans } from "./list-spans.js";

function fakeClient(response: unknown) {
  return {
    listSpans: vi.fn().mockResolvedValue(response),
  } as const;
}

describe("handleListSpans", () => {
  it("renders a §7.2-wrapped envelope over the API response", async () => {
    const client = fakeClient({
      spans: [
        {
          span_id: "span_1",
          trace_id: "trace_1",
          start_time: "2026-04-18T15:00:00Z",
          end_time: "2026-04-18T15:00:01.250Z",
          duration_ms: 1250,
          gen_ai_system: "openai",
          gen_ai_request_model: "gpt-4o-mini",
          gen_ai_usage_input_tokens: 42,
          gen_ai_usage_output_tokens: 18,
          status_code: 200,
          error_type: null,
          stream: false,
          user_id: null,
          session_id: null,
          tags: null,
          stream_truncated: false,
        },
      ],
      next_cursor: null,
    });

    const text = await handleListSpans(client as never, { limit: 50 });
    const parsed = JSON.parse(text);
    expect(parsed.source).toBe("spans");
    expect(parsed.primary.spans).toHaveLength(1);
    expect(parsed.primary.next_cursor).toBeNull();
    expect(parsed.warnings).toEqual([]);
    expect(parsed.caveats).toEqual([]);
    expect(typeof parsed.as_of).toBe("string");
  });

  it("surfaces a caveat when next_cursor is present", async () => {
    const client = fakeClient({
      spans: [{ span_id: "s", trace_id: "t", start_time: "2026-04-18T15:00:00Z", end_time: "2026-04-18T15:00:01Z", duration_ms: 1000, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o-mini", gen_ai_usage_input_tokens: 0, gen_ai_usage_output_tokens: 0, status_code: 200, error_type: null, stream: false, user_id: null, session_id: null, tags: null, stream_truncated: false }],
      next_cursor: "eyJ...",
    });
    const parsed = JSON.parse(await handleListSpans(client as never, { limit: 50 }));
    expect(parsed.caveats[0]).toMatch(/more results available/i);
  });

  it("surfaces an empty-result warning", async () => {
    const client = fakeClient({ spans: [], next_cursor: null });
    const parsed = JSON.parse(await handleListSpans(client as never, {}));
    expect(parsed.warnings[0]).toMatch(/no spans matched/i);
  });

  it("forwards filter parameters to the API client", async () => {
    const client = fakeClient({ spans: [], next_cursor: null });
    await handleListSpans(client as never, {
      model: "gpt-4o-mini",
      user_id: "u1",
      session_id: "s1",
      time_window: "24h",
      tags: ["prod"],
      min_duration_ms: 500,
      status_min: 400,
      status_max: 599,
      cursor: "abc",
      limit: 100,
    });
    expect(client.listSpans).toHaveBeenCalledWith({
      model: "gpt-4o-mini",
      user_id: "u1",
      session_id: "s1",
      time_window: "24h",
      tags: ["prod"],
      min_duration_ms: 500,
      status_min: 400,
      status_max: 599,
      cursor: "abc",
      limit: 100,
    });
  });
});
