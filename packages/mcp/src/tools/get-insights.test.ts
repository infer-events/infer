import { describe, it, expect, vi } from "vitest";
import { handleGetInsights } from "./get-insights.js";

const fakeClient = (response: unknown) =>
  ({ getInsights: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetInsights — LLM-obs shapes", () => {
  it("renders new-shape evidence keys (provider/model/feature)", async () => {
    const client = fakeClient({
      insights: [
        {
          id: "ins_1",
          type: "latency_regression",
          name: "gpt-4o p95 +58%",
          summary: "gpt-4o p95 latency up 58% since Wed 2pm",
          evidence: { provider: "openai", model: "gpt-4o", feature: "chat", p95_regression_pct: 58, sample_size: 312 },
          severity: "critical",
          detected_at: "2026-04-18T12:00:00Z",
          action_type: "code",
          suggested_action: "Check Wed 2pm deploys against gpt-4o prompt length",
          correlation_hint: "git log --since='2026-04-16'",
          related_events: [],
          confidence: "high",
          thread: null,
        },
      ],
      count: 1,
    });
    const text = await handleGetInsights(client as never, {});
    const parsed = JSON.parse(text);
    expect(parsed.source).toBe("insights");
    expect(parsed.primary.rendered_text).toContain("gpt-4o");
    expect(parsed.primary.rendered_text).toContain("58");
    expect(parsed.primary.rendered_text).toContain("model=gpt-4o");
  });

  it("renders legacy event-based evidence keys (backwards compat)", async () => {
    const client = fakeClient({
      insights: [
        {
          id: "ins_2",
          type: "volume_drop",
          name: "signup events down",
          summary: "signup volume dropped 40%",
          evidence: { event_name: "signup", count_7d: 120, baseline: 200, drop_pct: 40 },
          severity: "notable",
          detected_at: "2026-04-18T12:00:00Z",
          action_type: null,
          suggested_action: null,
          correlation_hint: null,
          related_events: ["signup"],
          confidence: "high",
          thread: null,
        },
      ],
      count: 1,
    });
    const text = await handleGetInsights(client as never, {});
    const parsed = JSON.parse(text);
    expect(parsed.primary.rendered_text).toContain("signup");
  });

  it("renders the empty state envelope with a warning", async () => {
    const client = fakeClient({ insights: [], count: 0 });
    const parsed = JSON.parse(await handleGetInsights(client as never, {}));
    expect(parsed.warnings.some((w: string) => w.includes("No new insights"))).toBe(true);
  });

  it("points LLM-obs insights at annotate_trace when a thread is attached", async () => {
    const client = fakeClient({
      insights: [
        {
          id: "ins_3",
          type: "error_rate_spike",
          name: "upstream_error rate up",
          summary: "error rate up 3x",
          evidence: { provider: "openai", model: "gpt-4o", error_rate: 0.08 },
          severity: "critical",
          detected_at: "2026-04-18T12:00:00Z",
          action_type: "code",
          suggested_action: "Check upstream health",
          correlation_hint: null,
          related_events: [],
          confidence: "high",
          thread: { thread_id: "trace_abc", title: "upstream errors", day_count: 2, first_detected_at: "2026-04-16T14:00:00Z", status: "active", latest_annotation: null },
        },
      ],
      count: 1,
    });
    const parsed = JSON.parse(await handleGetInsights(client as never, {}));
    expect(parsed.primary.rendered_text).toContain("annotate_trace");
  });

  it("surfaces a legacy-shape caveat when mixed insights include old schema", async () => {
    const client = fakeClient({
      insights: [
        { id: "ins_legacy", type: "volume_drop", name: "x", summary: "x", evidence: { event_name: "signup" }, severity: "notable", detected_at: "2026-04-18T12:00:00Z", action_type: null, suggested_action: null, correlation_hint: null, related_events: [], confidence: "high", thread: null },
      ],
      count: 1,
    });
    const parsed = JSON.parse(await handleGetInsights(client as never, {}));
    expect(parsed.caveats.some((c: string) => /legacy/i.test(c))).toBe(true);
  });
});
