import { describe, it, expect, vi } from "vitest";
import { handleGetCostStats } from "./get-cost-stats.js";

const fakeClient = (response: unknown) =>
  ({ getCostStats: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetCostStats", () => {
  it("computes cost for a single known model", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      rows: [
        // gpt-4o-mini: $0.15/M input + $0.60/M output
        // 1M * 0.15 + 0.25M * 0.60 = 0.15 + 0.15 = 0.30
        { dimension_key: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", count: 100, input_tokens: 1_000_000, output_tokens: 250_000 },
      ],
      pricing_source_version: "2026-04-01",
    });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.primary.groups[0].cost_usd).toBeCloseTo(0.30, 5);
    expect(parsed.primary.pricing_source_version).toBe("2026-04-01");
    expect(parsed.warnings).toEqual([]);
  });

  it("ollama provider returns $0 cost (no warning — zero is legitimate)", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      rows: [
        { dimension_key: "glm-5.1:cloud", provider: "ollama", model: "glm-5.1:cloud", count: 50, input_tokens: 10_000, output_tokens: 4_000 },
      ],
      pricing_source_version: "2026-04-01",
    });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.primary.groups[0].cost_usd).toBe(0);
    expect(parsed.warnings.every((w: string) => !w.includes("glm-5.1:cloud"))).toBe(true);
  });

  it("surfaces a warning when a model is NOT in PRICING_TABLE", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      rows: [
        { dimension_key: "gpt-5", provider: "openai", model: "gpt-5", count: 10, input_tokens: 5000, output_tokens: 2000 },
        { dimension_key: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", count: 100, input_tokens: 1000, output_tokens: 500 },
      ],
      pricing_source_version: "2026-04-01",
    });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.warnings.some((w: string) => w.includes("gpt-5") && w.includes("not in pricing table"))).toBe(true);
    const gpt5Group = parsed.primary.groups.find((g: { key: string }) => g.key === "gpt-5");
    expect(gpt5Group.cost_usd).toBeNull();
    const gpt4Group = parsed.primary.groups.find((g: { key: string }) => g.key === "gpt-4o-mini");
    expect(gpt4Group.cost_usd).toBeGreaterThan(0);
  });

  it("aggregates multiple (provider, model) rows under one dimension_key when dimension != model", async () => {
    const client = fakeClient({
      dimension: "user",
      time_window: "7d",
      rows: [
        // gpt-4o-mini: 0.5M * 0.15 + 0.1M * 0.60 = 0.075 + 0.06 = 0.135
        { dimension_key: "u_123", provider: "openai",    model: "gpt-4o-mini",      count: 50, input_tokens: 500_000, output_tokens: 100_000 },
        // claude-sonnet-4-6: 0.2M * 3.00 + 0.05M * 15.00 = 0.60 + 0.75 = 1.35
        { dimension_key: "u_123", provider: "anthropic", model: "claude-sonnet-4-6", count: 20, input_tokens: 200_000, output_tokens: 50_000 },
      ],
      pricing_source_version: "2026-04-01",
    });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "user", time_window: "7d" }));
    expect(parsed.primary.groups).toHaveLength(1);
    const group = parsed.primary.groups[0];
    expect(group.key).toBe("u_123");
    // 0.135 + 1.35 = 1.485
    expect(group.cost_usd).toBeCloseTo(1.485, 5);
    expect(group.per_model_breakdown).toHaveLength(2);
  });

  it("marks group cost_usd as null when ANY constituent model is missing pricing", async () => {
    const client = fakeClient({
      dimension: "user",
      time_window: "7d",
      rows: [
        { dimension_key: "u_1", provider: "openai", model: "gpt-4o-mini", count: 5, input_tokens: 1000, output_tokens: 500 },
        { dimension_key: "u_1", provider: "openai", model: "gpt-5",        count: 2, input_tokens: 500, output_tokens: 200 },
      ],
      pricing_source_version: "2026-04-01",
    });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "user", time_window: "7d" }));
    expect(parsed.primary.groups[0].cost_usd).toBeNull();
    expect(parsed.warnings.some((w: string) => w.includes("u_1") && w.includes("partial cost"))).toBe(true);
  });

  it("caveats describe query-time pricing semantics + surface pricing_source_version", async () => {
    const client = fakeClient({ dimension: "model", time_window: "7d", rows: [], pricing_source_version: "2026-04-01" });
    const parsed = JSON.parse(await handleGetCostStats(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.caveats.some((c: string) => c.includes("query time"))).toBe(true);
    expect(parsed.caveats.some((c: string) => c.includes("2026-04-01"))).toBe(true);
  });
});
