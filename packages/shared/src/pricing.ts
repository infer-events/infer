/**
 * Static pricing table for LLM model cost computation.
 * Prices are USD per million tokens.
 * Used by the get_cost_stats MCP tool (query-time cost computation).
 * Refresh manually when providers publish new prices.
 */
export const PRICING_TABLE = {
  version: "2026-04-01",
  openai: {
    "gpt-4o":                  { input: 2.50,  output: 10.00 },
    "gpt-4o-2024-08-06":       { input: 2.50,  output: 10.00 },
    "gpt-4o-mini":             { input: 0.15,  output: 0.60 },
    "gpt-4-turbo":             { input: 10.00, output: 30.00 },
    "gpt-3.5-turbo":           { input: 0.50,  output: 1.50 },
    "o1":                      { input: 15.00, output: 60.00 },
    "o1-mini":                 { input: 3.00,  output: 12.00 },
    "o3-mini":                 { input: 3.00,  output: 12.00 },
  } as Record<string, { input: number; output: number }>,
  anthropic: {
    "claude-sonnet-4-6":            { input: 3.00,  output: 15.00 },
    "claude-sonnet-4-6-20260401":   { input: 3.00,  output: 15.00 },
    "claude-opus-4-7":              { input: 15.00, output: 75.00 },
    "claude-opus-4-7-20260401":     { input: 15.00, output: 75.00 },
    "claude-haiku-4-5":             { input: 1.00,  output: 5.00 },
    "claude-haiku-4-5-20251001":    { input: 1.00,  output: 5.00 },
  } as Record<string, { input: number; output: number }>,
  ollama: {} as Record<string, { input: number; output: number }>,
};

export type PricingProvider = keyof typeof PRICING_TABLE | string;

export interface ModelPricing {
  input: number;  // USD per million tokens
  output: number;
}

/**
 * Look up pricing for a given (provider, model) pair.
 * Returns null if unknown. Ollama returns { input: 0, output: 0 } for any model.
 */
export function lookupPricing(provider: string, model: string): ModelPricing | null {
  if (provider === "ollama") {
    return { input: 0, output: 0 };
  }
  const providerTable = (PRICING_TABLE as Record<string, unknown>)[provider];
  if (!providerTable || typeof providerTable !== "object") return null;
  const modelEntry = (providerTable as Record<string, ModelPricing>)[model];
  return modelEntry ?? null;
}

/**
 * Compute estimated cost in USD for a span.
 * Returns null when the model is not in the pricing table or tokens are missing.
 */
export function computeCostUsd(
  provider: string,
  model: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const pricing = lookupPricing(provider, model);
  if (!pricing) return null;
  if (inputTokens === null || outputTokens === null) {
    // Ollama special-case: zero cost even with null tokens
    if (provider === "ollama") return 0;
    return null;
  }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
