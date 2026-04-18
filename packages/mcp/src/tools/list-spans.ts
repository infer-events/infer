import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface ListSpansParams {
  model?: string;
  user_id?: string;
  session_id?: string;
  time_window?: "1h" | "6h" | "24h" | "7d" | "30d";
  tags?: string[];
  min_duration_ms?: number;
  status_min?: number;
  status_max?: number;
  cursor?: string;
  limit?: number;
}

export async function handleListSpans(
  client: ApiClient,
  params: ListSpansParams,
): Promise<string> {
  const response = await client.listSpans(params);

  const warnings: string[] = [];
  const caveats: string[] = [];

  if (response.spans.length === 0) {
    warnings.push(
      "No spans matched these filters. Try widening the time_window or removing filters.",
    );
  }

  if (response.next_cursor !== null) {
    caveats.push(
      `More results available — pass cursor="${response.next_cursor}" to continue pagination.`,
    );
  }

  return toolResponseText(
    wrapResult({
      primary: response,
      source: "spans",
      warnings,
      caveats,
    }),
  );
}
