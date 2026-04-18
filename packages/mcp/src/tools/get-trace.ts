import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetTraceParams {
  trace_id: string;
}

export async function handleGetTrace(
  client: ApiClient,
  params: GetTraceParams,
): Promise<string> {
  const trace = await client.getTrace(params.trace_id);

  const warnings: string[] = [];
  const caveats: string[] = [
    "Token-estimated flag (gen_ai.usage.estimated) is NOT included in this projection. Call get_span(<span_id>) for full attributes.",
  ];

  const truncatedCount = trace.spans.filter((s) => s.stream_truncated).length;
  if (truncatedCount > 0) {
    warnings.push(
      `${truncatedCount} span(s) in this trace were stream-truncated — token counts and content may be incomplete.`,
    );
  }

  const errorCount = trace.spans.filter((s) => s.status_code >= 400).length;
  if (errorCount > 0) {
    warnings.push(
      `${errorCount} span(s) in this trace returned HTTP >= 400 — call get_span for error details.`,
    );
  }

  const rootCount = trace.spans.filter((s) => s.depth === 0).length;
  if (rootCount > 1) {
    warnings.push(
      `This trace has ${rootCount} unconnected roots — likely orphaned spans. ` +
        `root_span_id reports only the first; inspect spans[] for the full set.`,
    );
  }

  return toolResponseText(
    wrapResult({
      primary: trace,
      source: "spans",
      warnings,
      caveats,
    }),
  );
}
