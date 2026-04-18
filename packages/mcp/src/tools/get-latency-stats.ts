import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetLatencyStatsParams {
  dimension: "model" | "user" | "session" | "feature";
  time_window?: "1h" | "6h" | "24h" | "7d" | "30d";
}

const MIN_SAMPLE = 10;

export async function handleGetLatencyStats(
  client: ApiClient,
  params: GetLatencyStatsParams,
): Promise<string> {
  const result = await client.getLatencyStats({
    dimension: params.dimension,
    time_window: params.time_window ?? "24h",
  });

  const warnings: string[] = [];
  const caveats: string[] = [
    `Percentiles use PostgreSQL PERCENTILE_CONT(p) WITHIN GROUP over duration_ms.`,
    `Only successful spans (status_code < 400) are included — error spans skew tails unfairly.`,
  ];

  if (result.groups.length === 0) {
    warnings.push(
      `No data for dimension=${params.dimension} over the last ${params.time_window ?? "24h"}.`,
    );
  }

  for (const g of result.groups) {
    if (g.count < MIN_SAMPLE) {
      warnings.push(
        `Small sample: ${params.dimension}="${g.key}" has n=${g.count} (< ${MIN_SAMPLE}). Percentiles are directional only.`,
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
