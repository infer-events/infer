import { describe, it, expect, vi } from "vitest";
import { handleGetLatencyStats } from "./get-latency-stats.js";

const fakeClient = (response: unknown) =>
  ({ getLatencyStats: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetLatencyStats", () => {
  it("passes through groups as primary.groups", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "24h",
      groups: [{ key: "gpt-4o-mini", count: 1247, p50_ms: 485, p95_ms: 2310, p99_ms: 4120, mean_ms: 712 }],
    });
    const parsed = JSON.parse(await handleGetLatencyStats(client as never, { dimension: "model", time_window: "24h" }));
    expect(parsed.primary.groups).toHaveLength(1);
    expect(parsed.source).toBe("spans");
  });

  it("warns for groups with count < 10", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "24h",
      groups: [
        { key: "gpt-4o-mini", count: 5,  p50_ms: 485, p95_ms: 600,  p99_ms: 700,  mean_ms: 500 },
        { key: "gpt-4o",      count: 50, p50_ms: 800, p95_ms: 1200, p99_ms: 1500, mean_ms: 900 },
      ],
    });
    const parsed = JSON.parse(await handleGetLatencyStats(client as never, { dimension: "model", time_window: "24h" }));
    expect(parsed.warnings.some((w: string) => w.includes("gpt-4o-mini") && w.includes("n=5"))).toBe(true);
    // gpt-4o should NOT have a small-sample warning (count=50)
    expect(parsed.warnings.filter((w: string) => w.includes("gpt-4o") && !w.includes("gpt-4o-mini")).length).toBe(0);
  });

  it("surfaces caveats describing percentile computation + successful-only filter", async () => {
    const client = fakeClient({ dimension: "model", time_window: "24h", groups: [] });
    const parsed = JSON.parse(await handleGetLatencyStats(client as never, { dimension: "model", time_window: "24h" }));
    expect(parsed.caveats.some((c: string) => c.includes("PERCENTILE_CONT"))).toBe(true);
    expect(parsed.caveats.some((c: string) => c.includes("status_code < 400"))).toBe(true);
  });

  it("warns when zero groups returned", async () => {
    const client = fakeClient({ dimension: "model", time_window: "24h", groups: [] });
    const parsed = JSON.parse(await handleGetLatencyStats(client as never, { dimension: "model", time_window: "24h" }));
    expect(parsed.warnings.some((w: string) => /no data/i.test(w))).toBe(true);
  });
});
