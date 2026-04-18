import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient, ApiError } from "./api-client.js";
import { loadConfig, type InferConfig } from "./config.js";

// Active tool schemas
import {
  listSpansInputSchema,
  getTraceInputSchema,
  getSpanInputSchema,
  getLatencyStatsInputSchema,
  getTokenUsageInputSchema,
  getCostStatsInputSchema,
  getErrorSpansInputSchema,
  annotateSpanInputSchema,
  annotateTraceInputSchema,
} from "./tools/schemas.js";

// Active tool handlers
import { handleListSpans } from "./tools/list-spans.js";
import { handleGetTrace } from "./tools/get-trace.js";
import { handleGetSpan } from "./tools/get-span.js";
import { handleGetLatencyStats } from "./tools/get-latency-stats.js";
import { handleGetTokenUsage } from "./tools/get-token-usage.js";
import { handleGetCostStats } from "./tools/get-cost-stats.js";
import { handleGetErrorSpans } from "./tools/get-error-spans.js";
import { handleAnnotateSpan } from "./tools/annotate-span.js";
import { handleAnnotateTrace } from "./tools/annotate-trace.js";

// Adapted tools (kept)
import { getInsightsSchema, handleGetInsights } from "./tools/get-insights.js";
import { getProjectSummarySchema, handleGetProjectSummary } from "./tools/get-project-summary.js";

// Config helpers (kept)
import { createProjectSchema, handleCreateProject } from "./tools/create-project.js";
import { switchProjectSchema, handleSwitchProject } from "./tools/switch-project.js";

// Deprecation shims (7)
import { RETIRED_TOOL_SHIMS } from "./tools/deprecated-tools.js";

export function createServer(config: InferConfig): McpServer {
  async function getClient(): Promise<ApiClient> {
    try {
      const freshConfig = await loadConfig();
      return new ApiClient(freshConfig);
    } catch {
      return new ApiClient(config);
    }
  }

  const server = new McpServer({
    name: "infer-llm-obs",
    version: "1.0.0",
  });

  // ─── Span inspection (3 tools) ───────────────────────────────────────────

  server.tool(
    "list_spans",
    "List LLM calls (spans) captured by the Infer gateway. Filter by model, user, session, " +
      "tags, time window, duration, or HTTP status. Returns a paginated list with a cursor " +
      "for continuation. Use this to explore recent activity or find spans matching a specific filter.",
    listSpansInputSchema,
    async (params) => wrapMcp(async () => handleListSpans(await getClient(), params)),
  );

  server.tool(
    "get_trace",
    "Return all spans sharing a trace_id as a hierarchical tree (walks parent_span_id edges). " +
      "Use this when an agent made multiple LLM calls in one turn and you want to see the whole turn — " +
      "e.g., a multi-iteration agent that called a tool, saw the result, and called the model again.",
    getTraceInputSchema,
    async (params) => wrapMcp(async () => handleGetTrace(await getClient(), params)),
  );

  server.tool(
    "get_span",
    "Return full detail for a single span — messages, tool calls, attributes, annotations. " +
      "Use this after list_spans or get_trace to drill into a specific call.",
    getSpanInputSchema,
    async (params) => wrapMcp(async () => handleGetSpan(await getClient(), params)),
  );

  // ─── Aggregations (4 tools) ──────────────────────────────────────────────

  server.tool(
    "get_latency_stats",
    "p50/p95/p99 latency by dimension (model, user, session, or feature) over a time window. " +
      "Groups with fewer than 10 samples are surfaced as warnings. Use this to diagnose slowness or " +
      "compare models.",
    getLatencyStatsInputSchema,
    async (params) => wrapMcp(async () => handleGetLatencyStats(await getClient(), params)),
  );

  server.tool(
    "get_token_usage",
    "Sum input/output tokens by dimension (model, user, session, feature) over a time window. " +
      "Warns when any rows used tiktoken-estimated counts rather than upstream-authoritative counts.",
    getTokenUsageInputSchema,
    async (params) => wrapMcp(async () => handleGetTokenUsage(await getClient(), params)),
  );

  server.tool(
    "get_cost_stats",
    "Compute cost (USD) by dimension at query time from the @inferevents/shared pricing table. " +
      "Models missing from the pricing table surface as warnings with their (provider, model) name; their " +
      "cost is reported as null rather than silently zero. Ollama models return $0 legitimately.",
    getCostStatsInputSchema,
    async (params) => wrapMcp(async () => handleGetCostStats(await getClient(), params)),
  );

  server.tool(
    "get_error_spans",
    "List recent failures (status_code >= 400 OR stream_truncated) with aggregated error_type counts. " +
      "Warns on retry storms (attempt_count > 1). Use this to diagnose an error spike.",
    getErrorSpansInputSchema,
    async (params) => wrapMcp(async () => handleGetErrorSpans(await getClient(), params)),
  );

  // ─── Annotations (2 tools) ───────────────────────────────────────────────

  server.tool(
    "annotate_span",
    "Attach a finding to a specific span. Use after diagnosing a single LLM call — e.g., " +
      "'root cause: prompt was 3x longer than baseline'. The annotation surfaces in future get_span calls.",
    annotateSpanInputSchema,
    async (params) => wrapMcp(async () => handleAnnotateSpan(await getClient(), params)),
  );

  server.tool(
    "annotate_trace",
    "Attach a finding to a whole trace (multi-span agent turn). Use after diagnosing a multi-iteration " +
      "turn — e.g., 'upstream timeout triggered 3 retries, last attempt succeeded'. Surfaces in future " +
      "get_trace calls and in the insight-threads briefing.",
    annotateTraceInputSchema,
    async (params) => wrapMcp(async () => handleAnnotateTrace(await getClient(), params)),
  );

  // ─── Insights + summary (2 adapted tools) ────────────────────────────────

  server.tool(
    "get_insights",
    "Auto-detected anomalies and notable patterns — latency regressions, error-rate spikes, " +
      "token-consumption outliers, new models, new error types. Call get_project_summary first for full " +
      "context, then this for specific alerts. Each insight includes a correlation_hint for git-log lookups.",
    getInsightsSchema,
    async (params) => wrapMcp(async () => handleGetInsights(await getClient(), params)),
  );

  server.tool(
    "get_project_summary",
    "Project-level overview — model distribution, weekly spend, error rate, active anomaly threads. " +
      "Compiled hourly. Call this first when starting an investigation.",
    getProjectSummarySchema,
    async () => wrapMcp(async () => handleGetProjectSummary(await getClient())),
  );

  // ─── Config helpers (2 tools) ────────────────────────────────────────────

  server.tool(
    "switch_project",
    "Switch between Infer projects or list available ones. Operates on the local config file, " +
      "not the server.",
    switchProjectSchema,
    async (params) => wrapMcp(async () => handleSwitchProject(params)),
  );

  server.tool(
    "create_project",
    "Create a new Infer project from the CLI. Requires an active auth session from `npx @inferevents/skills run infer-setup`.",
    createProjectSchema,
    async (params) => wrapMcp(async () => {
      const freshConfig = await loadConfig().catch(() => config);
      return handleCreateProject(params, freshConfig.endpoint);
    }),
  );

  // ─── Deprecation shims (7 — retire on 2026-06-17) ────────────────────────

  for (const [toolName, entry] of Object.entries(RETIRED_TOOL_SHIMS)) {
    server.tool(toolName, entry.description, {}, async () => {
      const out = await entry.handler();
      return {
        content: out.content.map((c) => ({ type: "text" as const, text: c.text })),
        isError: out.isError,
      };
    });
  }

  return server;
}

/**
 * Wrap an async tool handler so a thrown error becomes a structured
 * `{ content, isError: true }` MCP response rather than a transport
 * fault. All active tools return a `string` (JSON-in-text) from their
 * handler; we forward that as `content[0].text`.
 */
async function wrapMcp(
  run: () => Promise<string>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    const text = await run();
    return { content: [{ type: "text", text }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: formatError(error) }],
      isError: true,
    };
  }
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return JSON.stringify(
      { error: "api_error", status_code: error.statusCode, message: error.message },
      null,
      2,
    );
  }
  if (error instanceof Error) {
    return JSON.stringify({ error: "internal_error", message: error.message }, null, 2);
  }
  return JSON.stringify({ error: "unknown_error" }, null, 2);
}
