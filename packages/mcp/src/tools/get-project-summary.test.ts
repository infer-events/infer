import { describe, it, expect } from "vitest";
import { formatProjectSummary } from "./get-project-summary.js";

describe("project summary formatter", () => {
  it("renders health bar and key metrics", () => {
    const output = formatProjectSummary({
      key_metrics: {
        total_events_30d: 45230,
        unique_users_30d: 1284,
        daily_active_avg: 142,
        error_rate_pct: 0.3,
        events_trend_pct: 12,
        users_trend_pct: 8,
        health_score: 7,
        active_issues: 2,
      },
    });

    expect(output).toContain("HEALTH: ●●●●●●●○○○ 7/10");
    expect(output).toContain("2 active issues");
    expect(output).toContain("45,230");
    expect(output).toContain("+12%");
    expect(output).toContain("1,284");
    expect(output).toContain("+8%");
    expect(output).toContain("~142");
    expect(output).toContain("0.3%");
  });

  it("renders singular active issue", () => {
    const output = formatProjectSummary({
      key_metrics: {
        total_events_30d: 100,
        unique_users_30d: 10,
        daily_active_avg: 5,
        error_rate_pct: 0,
        events_trend_pct: 0,
        users_trend_pct: 0,
        health_score: 9,
        active_issues: 1,
      },
    });

    expect(output).toContain("(1 active issue)");
    expect(output).not.toContain("issues)");
  });

  it("groups events by category with trend arrows", () => {
    const output = formatProjectSummary({
      event_catalog: [
        { event_name: "signup", category: "activation", count_30d: 500, unique_users_30d: 400, trend: "up" },
        { event_name: "page_view", category: "engagement", count_30d: 3000, unique_users_30d: 800, trend: "stable" },
        { event_name: "click", category: "engagement", count_30d: 1200, unique_users_30d: 600, trend: "down" },
      ],
    });

    expect(output).toContain("EVENT CATALOG (3 events tracked)");
    expect(output).toContain("activation: signup (500 ↑)");
    expect(output).toContain("engagement: page_view (3,000 →), click (1,200 ↓)");
  });

  it("shows funnel conversion with warning on decline", () => {
    const output = formatProjectSummary({
      funnel_health: [
        { from_event: "signup", to_event: "onboarding", conversion_pct: 72, trend: "stable" },
        { from_event: "onboarding", to_event: "purchase", conversion_pct: 18, trend: "down" },
      ],
    });

    expect(output).toContain("FUNNEL HEALTH");
    expect(output).toContain("signup → onboarding:  72% conversion");
    expect(output).toContain("onboarding → purchase:  18% conversion ⚠️");
    expect(output).not.toMatch(/signup.*onboarding.*⚠️/);
  });

  it("shows active threads with severity dots and annotations", () => {
    const output = formatProjectSummary({
      active_threads: [
        {
          id: "t-1",
          title: "signup volume declining",
          severity: "critical",
          day_count: 3,
          insight_count: 3,
          latest_annotation: "Root cause: deploy abc123 broke signup API",
        },
        {
          id: "t-2",
          title: "new error in checkout",
          severity: "notable",
          day_count: 1,
          insight_count: 1,
          latest_annotation: null,
        },
      ],
    });

    expect(output).toContain("ACTIVE THREADS (2)");
    expect(output).toContain("🔴 signup volume declining (3 days)");
    expect(output).toContain("↳ Root cause: deploy abc123 broke signup API");
    expect(output).toContain("🟡 new error in checkout");
    // day_count=1 should not show "(1 days)"
    expect(output).not.toContain("(1 days)");
    // No annotation arrow for thread without annotation
    const lines = output.split("\n");
    const checkoutLine = lines.findIndex((l) => l.includes("new error in checkout"));
    const nextLine = lines[checkoutLine + 1] ?? "";
    expect(nextLine).not.toContain("↳");
  });

  it("returns empty string when no sections provided", () => {
    const output = formatProjectSummary({});
    expect(output).toBe("");
  });
});
