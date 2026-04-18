import { describe, it, expect, vi } from "vitest";
import { handleGetErrorSpans } from "./get-error-spans.js";

const fakeClient = (response: unknown) =>
  ({ getErrorSpans: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetErrorSpans", () => {
  it("passes through rows + error_type_counts", async () => {
    const client = fakeClient({
      time_window: "24h",
      spans: [{ span_id: "s1", trace_id: "t1", start_time: "2026-04-18T14:00:00Z", end_time: "2026-04-18T14:00:01Z", duration_ms: 500, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", status_code: 500, error_type: "upstream_error", upstream_host: "api.openai.com", attempt_count: 2, stream_truncated: false }],
      error_type_counts: { upstream_error: 12 },
      next_cursor: null,
    });
    const parsed = JSON.parse(await handleGetErrorSpans(client as never, { time_window: "24h" }));
    expect(parsed.primary.spans).toHaveLength(1);
    expect(parsed.primary.error_type_counts.upstream_error).toBe(12);
  });

  it("warns when retry storms present (attempt_count > 1)", async () => {
    const client = fakeClient({
      time_window: "24h",
      spans: [{ span_id: "s1", trace_id: "t1", start_time: "2026-04-18T14:00:00Z", end_time: "2026-04-18T14:00:01Z", duration_ms: 500, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", status_code: 500, error_type: "upstream_error", upstream_host: "api.openai.com", attempt_count: 3, stream_truncated: false }],
      error_type_counts: { upstream_error: 1 },
      next_cursor: null,
    });
    const parsed = JSON.parse(await handleGetErrorSpans(client as never, { time_window: "24h" }));
    expect(parsed.warnings.some((w: string) => w.includes("retr"))).toBe(true);
  });

  it("surfaces a caveat with the cursor when next_cursor is returned", async () => {
    const client = fakeClient({ time_window: "24h", spans: [], error_type_counts: {}, next_cursor: "abc" });
    const parsed = JSON.parse(await handleGetErrorSpans(client as never, { time_window: "24h" }));
    expect(parsed.caveats.some((c: string) => c.includes('cursor="abc"'))).toBe(true);
  });

  it("surfaces an empty-result warning when no errors", async () => {
    const client = fakeClient({ time_window: "24h", spans: [], error_type_counts: {}, next_cursor: null });
    const parsed = JSON.parse(await handleGetErrorSpans(client as never, { time_window: "24h" }));
    expect(parsed.warnings.some((w: string) => /no errors/i.test(w))).toBe(true);
  });
});
