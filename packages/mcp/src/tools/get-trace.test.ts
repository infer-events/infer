import { describe, it, expect, vi } from "vitest";
import { handleGetTrace } from "./get-trace.js";

function fakeClient(response: unknown) {
  return { getTrace: vi.fn().mockResolvedValue(response) } as const;
}

describe("handleGetTrace", () => {
  it("renders a multi-span trace as a depth-indented tree", async () => {
    const client = fakeClient({
      trace_id: "trace_multi_iteration",
      root_span_id: "span_trace_parent",
      spans: [
        { span_id: "span_trace_parent", parent_span_id: null, depth: 0, start_time: "2026-04-18T15:00:00Z", end_time: "2026-04-18T15:00:02Z", duration_ms: 2000, gen_ai_system: "ollama", gen_ai_request_model: "glm-5.1:cloud", gen_ai_usage_input_tokens: 120, gen_ai_usage_output_tokens: 48, status_code: 200, error_type: null, finish_reasons: ["tool_calls"], stream: true, stream_truncated: false },
        { span_id: "span_trace_tool", parent_span_id: "span_trace_parent", depth: 1, start_time: "2026-04-18T15:00:02.100Z", end_time: "2026-04-18T15:00:03.500Z", duration_ms: 1400, gen_ai_system: "ollama", gen_ai_request_model: "glm-5.1:cloud", gen_ai_usage_input_tokens: 180, gen_ai_usage_output_tokens: 64, status_code: 200, error_type: null, finish_reasons: ["stop"], stream: true, stream_truncated: false },
        { span_id: "span_trace_followup", parent_span_id: "span_trace_tool", depth: 2, start_time: "2026-04-18T15:00:03.600Z", end_time: "2026-04-18T15:00:04.100Z", duration_ms: 500, gen_ai_system: "ollama", gen_ai_request_model: "glm-5.1:cloud", gen_ai_usage_input_tokens: 220, gen_ai_usage_output_tokens: 12, status_code: 200, error_type: null, finish_reasons: ["stop"], stream: true, stream_truncated: false },
      ],
      span_count: 3,
      total_duration_ms: 4100,
    });
    const text = await handleGetTrace(client as never, { trace_id: "trace_multi_iteration" });
    const parsed = JSON.parse(text);
    expect(parsed.source).toBe("spans");
    expect(parsed.primary.span_count).toBe(3);
    expect(parsed.primary.spans).toHaveLength(3);
    expect(parsed.primary.spans[1].depth).toBe(1);
  });

  it("warns when any span was truncated", async () => {
    const client = fakeClient({
      trace_id: "t1",
      root_span_id: "s1",
      spans: [
        { span_id: "s1", parent_span_id: null, depth: 0, start_time: "2026-04-18T15:00:00Z", end_time: "2026-04-18T15:00:02Z", duration_ms: 2000, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", gen_ai_usage_input_tokens: null, gen_ai_usage_output_tokens: null, status_code: 200, error_type: null, finish_reasons: null, stream: true, stream_truncated: true },
      ],
      span_count: 1,
      total_duration_ms: 2000,
    });
    const parsed = JSON.parse(await handleGetTrace(client as never, { trace_id: "t1" }));
    expect(parsed.warnings.some((w: string) => w.includes("truncated"))).toBe(true);
  });

  it("warns when any span returned an error", async () => {
    const client = fakeClient({
      trace_id: "t1",
      root_span_id: "s1",
      spans: [
        { span_id: "s1", parent_span_id: null, depth: 0, start_time: "2026-04-18T15:00:00Z", end_time: "2026-04-18T15:00:00.5Z", duration_ms: 500, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", gen_ai_usage_input_tokens: null, gen_ai_usage_output_tokens: null, status_code: 500, error_type: "upstream_error", finish_reasons: null, stream: false, stream_truncated: false },
      ],
      span_count: 1,
      total_duration_ms: 500,
    });
    const parsed = JSON.parse(await handleGetTrace(client as never, { trace_id: "t1" }));
    expect(parsed.warnings.some((w: string) => /error|400|500/.test(w))).toBe(true);
  });

  it("surfaces a caveat about full attributes via get_span", async () => {
    const client = fakeClient({ trace_id: "t1", root_span_id: "s1", spans: [], span_count: 0, total_duration_ms: 0 });
    const parsed = JSON.parse(await handleGetTrace(client as never, { trace_id: "t1" }));
    expect(parsed.caveats.some((c: string) => /get_span|attributes/i.test(c))).toBe(true);
  });

  it("rethrows ApiError verbatim on 404", async () => {
    const { ApiError } = await import("../api-client.js");
    const client = {
      getTrace: vi.fn().mockRejectedValue(new ApiError("Infer API returned 404: trace not found", 404)),
    } as const;
    await expect(handleGetTrace(client as never, { trace_id: "t1" })).rejects.toThrow(/404/);
  });

  it("warns when the trace has multiple roots (orphan salvage)", async () => {
    const client = fakeClient({
      trace_id: "t1",
      root_span_id: "s1",
      spans: [
        { span_id: "s1", parent_span_id: null, depth: 0, start_time: "2026-04-18T15:00:00Z", end_time: "2026-04-18T15:00:01Z", duration_ms: 1000, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", gen_ai_usage_input_tokens: 10, gen_ai_usage_output_tokens: 5, status_code: 200, error_type: null, finish_reasons: ["stop"], stream: false, stream_truncated: false },
        { span_id: "s2", parent_span_id: "orphan_parent_gone", depth: 0, start_time: "2026-04-18T15:00:02Z", end_time: "2026-04-18T15:00:03Z", duration_ms: 1000, gen_ai_system: "openai", gen_ai_request_model: "gpt-4o", gen_ai_usage_input_tokens: 10, gen_ai_usage_output_tokens: 5, status_code: 200, error_type: null, finish_reasons: ["stop"], stream: false, stream_truncated: false },
      ],
      span_count: 2,
      total_duration_ms: 3000,
    });
    const parsed = JSON.parse(await handleGetTrace(client as never, { trace_id: "t1" }));
    expect(parsed.warnings.some((w: string) => /unconnected roots/i.test(w))).toBe(true);
  });
});
