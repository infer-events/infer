import { describe, it, expect, vi } from "vitest";
import { handleGetProjectSummary } from "./get-project-summary.js";

const fakeClient = (response: unknown) =>
  ({ getProjectSummary: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetProjectSummary", () => {
  it("renders the new LLM-obs sections when present", async () => {
    const client = fakeClient({
      sections: {
        model_distribution: { "gpt-4o-mini": 0.72, "glm-5.1:cloud": 0.18, "claude-sonnet-4-6": 0.10 },
        weekly_spend_usd: 12.47,
        error_rate_7d: 0.023,
        anomaly_threads: [
          { thread_id: "trace_abc", title: "gpt-4o p95 regression", day_count: 2 },
        ],
      },
      compiled_at: "2026-04-18T11:00:00Z",
    });
    const parsed = JSON.parse(await handleGetProjectSummary(client as never));
    expect(parsed.primary.rendered_text).toContain("Model distribution");
    expect(parsed.primary.rendered_text).toContain("gpt-4o-mini");
    expect(parsed.primary.rendered_text).toContain("$12.47");
    expect(parsed.primary.rendered_text).toContain("2.3%");
    expect(parsed.primary.rendered_text).toContain("gpt-4o p95 regression");
  });

  it("falls back to legacy sections when new ones aren't present", async () => {
    const client = fakeClient({
      sections: {
        funnel_performance: { activation: 0.4, engagement: 0.2 },
        event_catalog: [{ name: "signup", count: 120 }],
      },
      compiled_at: "2026-04-18T11:00:00Z",
    });
    const parsed = JSON.parse(await handleGetProjectSummary(client as never));
    expect(parsed.primary.rendered_text).toContain("signup");
  });

  it("warns when no summary has been compiled yet", async () => {
    const client = fakeClient({ sections: {}, compiled_at: null, message: "wiki-compiler has not run yet" });
    const parsed = JSON.parse(await handleGetProjectSummary(client as never));
    expect(parsed.warnings.some((w: string) => w.includes("compiled"))).toBe(true);
  });

  it("surfaces a caveat when still rendering legacy-only sections", async () => {
    const client = fakeClient({
      sections: { funnel_performance: { activation: 0.4 }, event_catalog: [{ name: "signup", count: 120 }] },
      compiled_at: "2026-04-18T11:00:00Z",
    });
    const parsed = JSON.parse(await handleGetProjectSummary(client as never));
    expect(parsed.caveats.some((c: string) => /legacy web-analytics/i.test(c))).toBe(true);
  });
});
