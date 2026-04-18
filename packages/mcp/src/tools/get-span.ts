import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetSpanParams {
  span_id: string;
}

export async function handleGetSpan(
  client: ApiClient,
  params: GetSpanParams,
): Promise<string> {
  const result = await client.getSpan(params.span_id);
  const span = result.span as Record<string, unknown>;
  const attributes = (span.attributes as Record<string, unknown> | null) ?? {};

  const warnings: string[] = [];
  const caveats: string[] = [];

  const statusCode = span.status_code as number;
  if (statusCode >= 400) {
    const errorType = span.error_type as string | null;
    warnings.push(
      `Span returned HTTP status ${statusCode}${errorType ? ` (${errorType})` : ""}.`,
    );
  }

  if (attributes.stream_truncated === true) {
    warnings.push(
      "Stream was truncated mid-response — content and token counts are incomplete.",
    );
  }

  const usageEstimated = (attributes as Record<string, unknown>)["gen_ai.usage.estimated"];
  if (usageEstimated === true) {
    warnings.push(
      "Token counts are estimated (upstream did not emit authoritative usage). Treat as approximate.",
    );
  }

  if (span.body_stored === false) {
    caveats.push(
      "Messages redacted at ingest (x-infer-redact: true). Metadata and token counts are still available.",
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
