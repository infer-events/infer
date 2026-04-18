import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetTokenUsageParams {
  dimension: "model" | "user" | "session" | "feature";
  time_window: "1h" | "6h" | "24h" | "7d" | "30d";
}

export async function handleGetTokenUsage(
  client: ApiClient,
  params: GetTokenUsageParams,
): Promise<string> {
  const result = await client.getTokenUsage(params);

  const warnings: string[] = [];
  const caveats: string[] = [
    "Token counts sum gen_ai_usage_input_tokens + gen_ai_usage_output_tokens per span.",
    "Rows with NULL token counts contribute 0 to their group total.",
  ];

  if (result.groups.length === 0) {
    warnings.push(`No token data for dimension=${params.dimension} over the last ${params.time_window}.`);
  }

  for (const g of result.groups) {
    if (g.estimated_fraction > 0) {
      const pct = Math.round(g.estimated_fraction * 100);
      warnings.push(
        `${params.dimension}="${g.key}" — ${pct}% of spans have tiktoken-estimated token counts (upstream did not emit authoritative usage). Totals are approximate.`,
      );
    }
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
