import { z } from "zod";

/**
 * Message content can be either a plain string (OpenAI-style)
 * or an array of typed content blocks (Anthropic-style: text + tool_use).
 */
const messageContentBlockSchema = z.object({
  type: z.enum(["text", "tool_use", "tool_result", "image"]),
  text: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  content: z.unknown().optional(),
}).passthrough();

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.union([z.string(), z.array(messageContentBlockSchema)]).nullable().optional(),
  tool_calls: z.array(z.unknown()).optional(),
  tool_call_id: z.string().optional(),
  finish_reason: z.string().optional(),
  choice_index: z.number().int().optional(),
}).passthrough();

/**
 * Finish reasons OTEL accepts per choice.
 * Common values: "stop", "length", "tool_calls", "tool_use", "content_filter".
 */
const finishReasonsSchema = z.array(z.string()).nullable();

export const SpanSchema = z.object({
  // OTEL identity
  span_id: z.string().min(1),
  trace_id: z.string().min(1),
  parent_span_id: z.string().nullable(),

  // Tenancy
  project_id: z.string().min(1),

  // Timing
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),

  // Flattened OTEL gen_ai.*
  gen_ai_system: z.string().min(1),
  gen_ai_operation_name: z.string().min(1),
  gen_ai_request_model: z.string().nullable(),
  gen_ai_response_model: z.string().nullable(),
  gen_ai_usage_input_tokens: z.number().int().nonnegative().nullable(),
  gen_ai_usage_output_tokens: z.number().int().nonnegative().nullable(),
  gen_ai_request_temperature: z.number().nullable(),
  gen_ai_request_max_tokens: z.number().int().positive().nullable(),
  gen_ai_response_finish_reasons: finishReasonsSchema,

  // Cost — NULL in Phase 1; computed at query time in Phase 4 via get_cost_stats
  // (see docs/superpowers/specs/2026-04-17-agent-gateway-pivot-design.md §7.3).
  cost_usd: z.number().nullable(),

  // HTTP layer
  status_code: z.number().int().min(100).max(599),
  error_type: z.string().nullable(),
  upstream_host: z.string().min(1),
  upstream_request_id: z.string().nullable(),

  // Infer internals
  request_id: z.string().min(1),
  attempt_count: z.number().int().positive().default(1),
  body_stored: z.boolean(),
  stream: z.boolean(),

  // Infer metadata (from x-infer-* headers)
  session_id: z.string().nullable(),
  user_id: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  metadata: z.record(z.unknown()).default({}),

  // Messages (OTEL events, inlined)
  messages: z.array(messageSchema).nullable(),

  // OTEL attribute bag
  attributes: z.record(z.unknown()).default({}),
});

export type Span = z.infer<typeof SpanSchema>;

export const SpanBatchSchema = z.object({
  spans: z.array(SpanSchema).min(1).max(500),
});

export type SpanBatch = z.infer<typeof SpanBatchSchema>;

export const SpanAnnotationSchema = z.object({
  span_id: z.string().min(1),
  content: z.string().min(1),
  author: z.string().nullable(),
});

export type SpanAnnotationInput = z.infer<typeof SpanAnnotationSchema>;

export const TraceAnnotationSchema = z.object({
  trace_id: z.string().min(1),
  content: z.string().min(1),
  author: z.string().nullable(),
});

export type TraceAnnotationInput = z.infer<typeof TraceAnnotationSchema>;
