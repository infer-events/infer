import type { ApiClient } from "../api-client.js";
import { computeCostUsd } from "@inferevents/shared";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface GetCostStatsParams {
  dimension: "model" | "user" | "session" | "feature";
  time_window: "1h" | "6h" | "24h" | "7d" | "30d";
}

interface RawRow {
  dimension_key: string | null;
  provider: string;
  model: string;
  count: number;
  input_tokens: number;
  output_tokens: number;
}

interface ModelBreakdown {
  provider: string;
  model: string;
  count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
}

interface Group {
  key: string | null;
  count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  per_model_breakdown: ModelBreakdown[];
}

/**
 * Compute query-time cost per dimension group by joining raw token totals
 * against @inferevents/shared PRICING_TABLE.
 *
 * Contract — silent-zero defense:
 *   - Unknown (provider, model) pair → cost_usd=null on that per-model breakdown
 *     AND null-propagates to the group total AND emits a named warning. NEVER
 *     silently zero-cost an unknown model.
 *   - Ollama short-circuits to $0 (free by design). That is legitimate zero,
 *     NOT missing pricing. No warning is emitted for ollama models.
 */
export async function handleGetCostStats(
  client: ApiClient,
  params: GetCostStatsParams,
): Promise<string> {
  const result = await client.getCostStats(params);
  const rows = result.rows as RawRow[];

  const warnings: string[] = [];
  const caveats: string[] = [
    `Costs computed at query time from @inferevents/shared PRICING_TABLE (version ${result.pricing_source_version}). The spans.cost_usd column is not populated at ingest.`,
    `Zero-cost entries for provider="ollama" are legitimate (Ollama is free by design), not a missing-pricing warning.`,
  ];

  const missingModels = new Set<string>();

  const byKey = new Map<string | null, Group>();
  for (const r of rows) {
    const key = r.dimension_key;
    let group = byKey.get(key);
    if (!group) {
      group = { key, count: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, per_model_breakdown: [] };
      byKey.set(key, group);
    }
    group.count += r.count;
    group.input_tokens += r.input_tokens;
    group.output_tokens += r.output_tokens;

    const cost = computeCostUsd(r.provider, r.model, r.input_tokens, r.output_tokens);

    if (cost === null) {
      // Missing from PRICING_TABLE. Ollama short-circuits to 0 inside computeCostUsd,
      // so null here strictly means "unknown (provider, model)".
      missingModels.add(`${r.provider}:${r.model}`);
      group.cost_usd = null; // null propagates up — never silently zero.
    } else if (group.cost_usd !== null) {
      group.cost_usd += cost;
    }

    group.per_model_breakdown.push({
      provider: r.provider,
      model: r.model,
      count: r.count,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      cost_usd: cost,
    });
  }

  for (const missing of missingModels) {
    warnings.push(
      `Model "${missing}" not in pricing table — cost computation skipped. Update @inferevents/shared PRICING_TABLE to include this model's input/output rates.`,
    );
  }

  for (const group of byKey.values()) {
    if (group.cost_usd === null && params.dimension !== "model") {
      const affected = group.per_model_breakdown.filter((b) => b.cost_usd === null).map((b) => b.model);
      warnings.push(
        `${params.dimension}="${group.key}" has partial cost (cannot sum to total) because these models lack pricing: ${affected.join(", ")}.`,
      );
    }
  }

  if (byKey.size === 0) {
    warnings.push(`No cost data for dimension=${params.dimension} over the last ${params.time_window}.`);
  }

  // Sort: higher cost first. Null-cost groups sink to the end so missing-pricing
  // entries don't fake-top the ranking and mislead the agent.
  const groups = Array.from(byKey.values()).sort((a, b) => {
    if (a.cost_usd === null && b.cost_usd === null) return 0;
    if (a.cost_usd === null) return 1;
    if (b.cost_usd === null) return -1;
    return b.cost_usd - a.cost_usd;
  });

  return toolResponseText(
    wrapResult({
      primary: {
        dimension: result.dimension,
        time_window: result.time_window,
        groups,
        pricing_source_version: result.pricing_source_version,
      },
      source: "spans",
      warnings,
      caveats,
    }),
  );
}
