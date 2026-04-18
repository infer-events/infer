import { buildDeprecationShim, type ToolHandlerResponse } from "./deprecated.js";

const SUNSET_ON = "2026-06-17";

interface RetiredEntry {
  description: string;
  handler: () => Promise<ToolHandlerResponse>;
}

/**
 * The 6 retired web-analytics tools. Their old registrations in server.ts
 * become handlers that emit the deprecation envelope from
 * `buildDeprecationShim`. After 2026-06-17 these registrations should be
 * deleted outright and callers will see "unknown tool" from the MCP SDK.
 *
 * Spec §7.1 retired list + §8.4 60-day shim window.
 */
export const RETIRED_TOOL_SHIMS: Record<string, RetiredEntry> = {
  get_event_counts: {
    description:
      "DEPRECATED — web-analytics tool. Returns a deprecation notice. " +
      `Retires on ${SUNSET_ON}. Use list_spans + get_token_usage for LLM-obs equivalents.`,
    handler: buildDeprecationShim({
      toolName: "get_event_counts",
      replacementTools: ["list_spans", "get_token_usage"],
      sunsetOn: SUNSET_ON,
      reason: "Infer pivoted from web-analytics events to LLM-obs spans; event-count aggregation has no direct LLM-obs analogue.",
    }),
  },
  get_retention: {
    description:
      `DEPRECATED — web-analytics tool. Retires on ${SUNSET_ON}. Cohort retention has no LLM-obs equivalent.`,
    handler: buildDeprecationShim({
      toolName: "get_retention",
      replacementTools: [],
      sunsetOn: SUNSET_ON,
      reason: "Cohort-based retention doesn't map to LLM-obs data; sessions are short-lived, not repeated returns.",
    }),
  },
  get_top_events: {
    description: `DEPRECATED — retires on ${SUNSET_ON}. Use list_spans to inspect recent spans.`,
    handler: buildDeprecationShim({
      toolName: "get_top_events",
      replacementTools: ["list_spans"],
      sunsetOn: SUNSET_ON,
      reason: "Event-count leaderboards don't apply to LLM-obs; a get_top_models tool is planned for v1.1.",
    }),
  },
  get_user_journey: {
    description: `DEPRECATED — retires on ${SUNSET_ON}. Use get_trace (for one trace) or list_spans (filtered by user_id).`,
    handler: buildDeprecationShim({
      toolName: "get_user_journey",
      replacementTools: ["get_trace", "list_spans"],
      sunsetOn: SUNSET_ON,
      reason: "Per-user event journeys are replaced by per-trace span trees (get_trace) and user-filtered span lists (list_spans?user_id=...).",
    }),
  },
  get_ontology: {
    description: `DEPRECATED — retires on ${SUNSET_ON}. No LLM-obs equivalent.`,
    handler: buildDeprecationShim({
      toolName: "get_ontology",
      replacementTools: [],
      sunsetOn: SUNSET_ON,
      reason: "Event ontology (activation/engagement/monetization classification) is a web-analytics concept and doesn't apply to LLM calls.",
    }),
  },
  update_ontology: {
    description: `DEPRECATED — retires on ${SUNSET_ON}. No LLM-obs equivalent.`,
    handler: buildDeprecationShim({
      toolName: "update_ontology",
      replacementTools: [],
      sunsetOn: SUNSET_ON,
      reason: "Event ontology doesn't apply to LLM-obs data.",
    }),
  },
  annotate_thread: {
    description:
      `DEPRECATED — split into annotate_span + annotate_trace on 2026-04-18. Retires on ${SUNSET_ON}. ` +
      `Use annotate_span(span_id, content) for single-call findings or annotate_trace(trace_id, content) for agent-turn diagnoses.`,
    handler: buildDeprecationShim({
      toolName: "annotate_thread",
      replacementTools: ["annotate_span", "annotate_trace"],
      sunsetOn: SUNSET_ON,
      reason: "Thread-based annotation is replaced by two finer-grained tools: span-level (one LLM call) and trace-level (one agent turn).",
    }),
  },
};
