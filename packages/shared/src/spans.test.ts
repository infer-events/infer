import { describe, it, expect } from "vitest";
import { SpanSchema, SpanBatchSchema } from "./spans.js";

describe("SpanSchema", () => {
  const validSpan = {
    span_id: "7d8e9f0a1b2c3d4e",
    trace_id: "5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d",
    parent_span_id: null,
    project_id: "proj_01HXABC123DEF456789G",
    start_time: "2026-04-17T12:34:56.789Z",
    end_time: "2026-04-17T12:34:57.412Z",
    gen_ai_system: "openai",
    gen_ai_operation_name: "chat",
    gen_ai_request_model: "gpt-4o",
    gen_ai_response_model: "gpt-4o-2024-08-06",
    gen_ai_usage_input_tokens: 13,
    gen_ai_usage_output_tokens: 7,
    gen_ai_request_temperature: null,
    gen_ai_request_max_tokens: 100,
    gen_ai_response_finish_reasons: ["stop"],
    cost_usd: null,
    status_code: 200,
    error_type: null,
    upstream_host: "api.openai.com",
    upstream_request_id: "req_01abc",
    request_id: "sha256:f7a7b9",
    attempt_count: 1,
    body_stored: true,
    stream: false,
    session_id: null,
    user_id: "usr_42",
    tags: null,
    metadata: {},
    messages: [
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "2+2 equals 4.", finish_reason: "stop" },
    ],
    attributes: { "openai.system_fingerprint": "fp_abc123" },
  };

  it("parses a valid OpenAI span", () => {
    const result = SpanSchema.safeParse(validSpan);
    expect(result.success).toBe(true);
  });

  it("rejects a span missing span_id", () => {
    const bad = { ...validSpan };
    delete (bad as { span_id?: string }).span_id;
    const result = SpanSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a span with negative token counts", () => {
    const bad = { ...validSpan, gen_ai_usage_input_tokens: -1 };
    const result = SpanSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a span with status_code outside HTTP range", () => {
    const bad = { ...validSpan, status_code: 99 };
    const result = SpanSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts a span with nested messages array for multi-modal content", () => {
    const ok = {
      ...validSpan,
      messages: [
        { role: "user", content: "What's the weather in Paris?" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "I'll check." },
            { type: "tool_use", id: "toolu_01", name: "get_weather", input: { city: "Paris" } },
          ],
          finish_reason: "tool_use",
        },
      ],
    };
    const result = SpanSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });
});

describe("SpanBatchSchema", () => {
  it("accepts a batch of 1 span", () => {
    const batch = {
      spans: [
        {
          span_id: "a",
          trace_id: "b",
          parent_span_id: null,
          project_id: "proj_x",
          start_time: "2026-04-17T12:00:00.000Z",
          end_time: "2026-04-17T12:00:01.000Z",
          gen_ai_system: "openai",
          gen_ai_operation_name: "chat",
          gen_ai_request_model: null,
          gen_ai_response_model: null,
          gen_ai_usage_input_tokens: null,
          gen_ai_usage_output_tokens: null,
          gen_ai_request_temperature: null,
          gen_ai_request_max_tokens: null,
          gen_ai_response_finish_reasons: null,
          cost_usd: null,
          status_code: 200,
          error_type: null,
          upstream_host: "api.openai.com",
          upstream_request_id: null,
          request_id: "rid",
          attempt_count: 1,
          body_stored: false,
          stream: false,
          session_id: null,
          user_id: null,
          tags: null,
          metadata: {},
          messages: null,
          attributes: {},
        },
      ],
    };
    const result = SpanBatchSchema.safeParse(batch);
    expect(result.success).toBe(true);
  });

  it("rejects a batch with zero spans", () => {
    const result = SpanBatchSchema.safeParse({ spans: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a batch with more than 500 spans", () => {
    const oneSpan = {
      span_id: "a", trace_id: "b", parent_span_id: null, project_id: "p",
      start_time: "2026-04-17T12:00:00.000Z", end_time: "2026-04-17T12:00:01.000Z",
      gen_ai_system: "openai", gen_ai_operation_name: "chat",
      gen_ai_request_model: null, gen_ai_response_model: null,
      gen_ai_usage_input_tokens: null, gen_ai_usage_output_tokens: null,
      gen_ai_request_temperature: null, gen_ai_request_max_tokens: null,
      gen_ai_response_finish_reasons: null, cost_usd: null,
      status_code: 200, error_type: null,
      upstream_host: "api.openai.com", upstream_request_id: null,
      request_id: "rid", attempt_count: 1,
      body_stored: false, stream: false,
      session_id: null, user_id: null, tags: null,
      metadata: {}, messages: null, attributes: {},
    };
    const bigBatch = { spans: Array.from({ length: 501 }, () => oneSpan) };
    const result = SpanBatchSchema.safeParse(bigBatch);
    expect(result.success).toBe(false);
  });
});
