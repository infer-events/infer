import { z } from "zod";

/**
 * Shared Zod schemas for every new Phase 4 tool. One file so:
 *   - Handlers and tests import the same shape.
 *   - Code reviewers can audit §7.4 (no project_id) in a single place.
 *   - Future tools add to this file before creating their handler.
 *
 * Each export is a bare-keys object (not a zod.object(...)) because the MCP
 * SDK's `server.tool(name, description, schemaKeys, handler)` call wants the
 * keys object directly, not a wrapped schema. Tests build `z.object(keys)`
 * when they need to exercise parsing.
 */

const TIME_WINDOW = z
  .enum(["1h", "6h", "24h", "7d", "30d"])
  .describe(
    "Time window for stat aggregation. 24h = rolling 24 hours back from now.",
  );

const DIMENSION = z
  .enum(["model", "user", "session", "feature"])
  .describe(
    "Dimension to group by. `model` = gen_ai_request_model; `user` = user_id; " +
      "`session` = session_id; `feature` = metadata->>'feature'.",
  );

const LIMIT = z
  .number()
  .int()
  .min(1)
  .max(200)
  .describe("Max rows (default 50, hard cap 200).");

export const listSpansInputSchema = {
  model: z.string().optional().describe("Exact match on `gen_ai_request_model`."),
  user_id: z.string().optional().describe("Exact match on span `user_id`."),
  session_id: z.string().optional().describe("Exact match on span `session_id`."),
  time_window: TIME_WINDOW.optional().describe(
    "If present, restricts to spans whose `start_time` falls inside the window.",
  ),
  tags: z.array(z.string()).optional().describe("Must contain ALL given tags."),
  min_duration_ms: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Filter spans whose `duration_ms` is at least this many ms."),
  status_min: z.number().int().optional().describe("Minimum HTTP status_code (inclusive)."),
  status_max: z.number().int().optional().describe("Maximum HTTP status_code (inclusive)."),
  cursor: z
    .string()
    .optional()
    .describe("Opaque pagination cursor from a previous `list_spans` call."),
  limit: LIMIT.optional(),
};

export const getTraceInputSchema = {
  trace_id: z.string().min(1).describe("Trace ID returned by any gateway call (from the `x-infer-trace-id` response header)."),
};

export const getSpanInputSchema = {
  span_id: z.string().min(1).describe("Span ID (from `x-infer-span-id`)."),
};

export const getLatencyStatsInputSchema = {
  dimension: DIMENSION,
  time_window: TIME_WINDOW.optional().describe("Default: `24h`."),
};

export const getTokenUsageInputSchema = {
  dimension: DIMENSION,
  time_window: TIME_WINDOW,
};

export const getCostStatsInputSchema = {
  dimension: DIMENSION,
  time_window: TIME_WINDOW,
};

export const getErrorSpansInputSchema = {
  time_window: TIME_WINDOW.optional().describe("Default: `24h`."),
  limit: LIMIT.optional(),
  cursor: z.string().optional(),
};

export const annotateSpanInputSchema = {
  span_id: z.string().min(1).describe("The span_id to attach the annotation to."),
  content: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "Your finding — what this span shows, root cause, context. Surfaces in `get_span` output going forward.",
    ),
};

export const annotateTraceInputSchema = {
  trace_id: z.string().min(1).describe("The trace_id to annotate (applies to the whole trace, not a single span)."),
  content: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "Trace-level finding — conclusion about the multi-span agent turn. " +
        "Use for root-cause writeups that don't belong to any single span.",
    ),
};
