import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetErrorSpansParams {
  time_window?: "1h" | "6h" | "24h" | "7d" | "30d";
  limit?: number;
  cursor?: string;
}

export async function handleGetErrorSpans(
  client: ApiClient,
  params: GetErrorSpansParams,
): Promise<string> {
  const result = await client.getErrorSpans(params);

  const warnings: string[] = [];
  const caveats: string[] = [
    "Includes status_code >= 400 AND stream_truncated = true rows (truncated streams are effective failures even at HTTP 200).",
  ];

  const retryStormCount = result.spans.filter((s) => s.attempt_count > 1).length;
  if (retryStormCount > 0) {
    warnings.push(
      `${retryStormCount} failure(s) were retried (attempt_count > 1). Check upstream stability or client retry configuration.`,
    );
  }

  if (result.spans.length === 0) {
    warnings.push(
      `No errors in the last ${params.time_window ?? "24h"} — either things are stable or no traffic reached the gateway.`,
    );
  }

  if (result.next_cursor !== null) {
    caveats.push(
      `More results available — call get_error_spans again with cursor="${result.next_cursor}".`,
    );
  }

  return toolResponseText(
    wrapResult({
      primary: result,
      source: "spans",
      warnings,
      caveats,
    }),
  );
}
