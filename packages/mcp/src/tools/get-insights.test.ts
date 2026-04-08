import { describe, it, expect } from "vitest";

// Extract the formatting logic for testing
function formatBriefing(insights: Array<{
  severity: string;
  summary: string;
  action_type: string | null;
  suggested_action: string | null;
  correlation_hint: string | null;
  related_events: string[];
  confidence: string;
  thread?: { thread_id: string; day_count: number; first_detected_at: string; latest_annotation?: string | null } | null;
}>): string {
  const severityIcon: Record<string, string> = {
    critical: "!!",
    notable: "!",
    informational: "i",
  };

  const confidenceLabel: Record<string, string> = {
    low: "directional, limited data",
    medium: "moderate confidence",
    high: "high confidence",
  };

  const codeActions = insights.filter((i) => i.action_type === "code");
  const strategyActions = insights.filter((i) => i.action_type === "strategy");
  const unclassified = insights.filter((i) => !i.action_type);

  const chart: string[] = [
    `${insights.length} items need your attention`,
    `${"─".repeat(50)}`,
  ];

  if (codeActions.length > 0) {
    chart.push("");
    chart.push("CODE ACTIONS (investigate / fix)");
    chart.push("");
    for (const insight of codeActions) {
      const icon = severityIcon[insight.severity] ?? "?";
      const conf = insight.confidence !== "high" ? ` (${confidenceLabel[insight.confidence] ?? ""})` : "";
      chart.push(`[${icon}] ${insight.summary}${conf}`);
      const thread = insight.thread;
      if (thread && thread.day_count > 1) {
        chart.push(`    Day ${thread.day_count} — ongoing since ${thread.first_detected_at.split("T")[0]}`);
      }
      if (thread?.latest_annotation) {
        chart.push(`    Note: ${thread.latest_annotation}`);
      }
      if (thread) {
        chart.push(`    Thread: ${thread.thread_id}`);
      }
      if (insight.suggested_action) {
        chart.push(`    Action: ${insight.suggested_action}`);
      }
      if (insight.correlation_hint) {
        chart.push(`    Git hint: ${insight.correlation_hint}`);
      }
      if (insight.related_events.length > 0) {
        chart.push(`    Events: ${insight.related_events.join(", ")}`);
      }
      chart.push("");
    }
  }

  if (strategyActions.length > 0) {
    chart.push("");
    chart.push("STRATEGY (your call)");
    chart.push("");
    for (const insight of strategyActions) {
      const icon = severityIcon[insight.severity] ?? "?";
      const conf = insight.confidence !== "high" ? ` (${confidenceLabel[insight.confidence] ?? ""})` : "";
      chart.push(`[${icon}] ${insight.summary}${conf}`);
      const thread = insight.thread;
      if (thread && thread.day_count > 1) {
        chart.push(`    Day ${thread.day_count} — ongoing since ${thread.first_detected_at.split("T")[0]}`);
      }
      if (thread?.latest_annotation) {
        chart.push(`    Note: ${thread.latest_annotation}`);
      }
      if (thread) {
        chart.push(`    Thread: ${thread.thread_id}`);
      }
      if (insight.suggested_action) {
        chart.push(`    Action: ${insight.suggested_action}`);
      }
      chart.push("");
    }
  }

  if (unclassified.length > 0) {
    chart.push("");
    chart.push("OTHER");
    chart.push("");
    for (const insight of unclassified) {
      const icon = severityIcon[insight.severity] ?? "?";
      chart.push(`[${icon}] ${insight.severity.toUpperCase()}: ${insight.summary}`);
      chart.push("");
    }
  }

  return chart.join("\n");
}

describe("MCP briefing formatter", () => {
  it("splits code and strategy actions into sections", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "signup dropped 50%",
        action_type: "code",
        suggested_action: "Investigate signup flow",
        correlation_hint: "check commits touching signup",
        related_events: ["signup"],
        confidence: "high",
      },
      {
        severity: "notable",
        summary: "traffic source shifted",
        action_type: "strategy",
        suggested_action: "Review ad spend",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
      },
    ]);

    expect(output).toContain("CODE ACTIONS (investigate / fix)");
    expect(output).toContain("STRATEGY (your call)");
    expect(output).toContain("[!!] signup dropped 50%");
    expect(output).toContain("[!] traffic source shifted");
    expect(output).toContain("2 items need your attention");
  });

  it("shows confidence caveat for low confidence", () => {
    const output = formatBriefing([
      {
        severity: "notable",
        summary: "volume dropped 30%",
        action_type: "code",
        suggested_action: "Check tracking",
        correlation_hint: null,
        related_events: [],
        confidence: "low",
      },
    ]);

    expect(output).toContain("(directional, limited data)");
  });

  it("hides confidence caveat for high confidence", () => {
    const output = formatBriefing([
      {
        severity: "notable",
        summary: "volume dropped 30%",
        action_type: "code",
        suggested_action: "Check tracking",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
      },
    ]);

    expect(output).not.toContain("directional");
    expect(output).not.toContain("moderate");
  });

  it("shows git hint and related events for code actions", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "error spike",
        action_type: "code",
        suggested_action: "Investigate deployments",
        correlation_hint: "check commits in the last 24 hours",
        related_events: ["error"],
        confidence: "high",
      },
    ]);

    expect(output).toContain("Git hint: check commits in the last 24 hours");
    expect(output).toContain("Events: error");
  });

  it("does not show git hint for strategy actions", () => {
    const output = formatBriefing([
      {
        severity: "informational",
        summary: "milestone crossed",
        action_type: "strategy",
        suggested_action: "Growth is on track",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
      },
    ]);

    expect(output).not.toContain("Git hint:");
    expect(output).toContain("Action: Growth is on track");
  });

  it("puts unclassified insights in OTHER section", () => {
    const output = formatBriefing([
      {
        severity: "informational",
        summary: "something happened",
        action_type: null,
        suggested_action: null,
        correlation_hint: null,
        related_events: [],
        confidence: "medium",
      },
    ]);

    expect(output).toContain("OTHER");
    expect(output).toContain("[i] INFORMATIONAL: something happened");
    expect(output).not.toContain("CODE ACTIONS");
    expect(output).not.toContain("STRATEGY");
  });

  it("only shows sections that have insights", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "payment flow broken",
        action_type: "code",
        suggested_action: "Fix checkout",
        correlation_hint: "check payment files",
        related_events: ["purchase"],
        confidence: "high",
      },
    ]);

    expect(output).toContain("CODE ACTIONS");
    expect(output).not.toContain("STRATEGY");
    expect(output).not.toContain("OTHER");
  });

  it("shows Day N when thread has day_count > 1", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "signup drop ongoing",
        action_type: "code",
        suggested_action: "Check OAuth",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
        thread: {
          thread_id: "thread-abc",
          day_count: 3,
          first_detected_at: "2026-03-31T10:00:00Z",
          latest_annotation: null,
        },
      },
    ]);

    expect(output).toContain("Day 3 — ongoing since 2026-03-31");
  });

  it("shows Note when thread has latest_annotation", () => {
    const output = formatBriefing([
      {
        severity: "notable",
        summary: "traffic shifted",
        action_type: "strategy",
        suggested_action: "Review channels",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
        thread: {
          thread_id: "thread-def",
          day_count: 5,
          first_detected_at: "2026-03-28T08:00:00Z",
          latest_annotation: "Likely caused by new ad campaign",
        },
      },
    ]);

    expect(output).toContain("Day 5 — ongoing since 2026-03-28");
    expect(output).toContain("Note: Likely caused by new ad campaign");
  });

  it("does not show thread context when thread is null", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "error spike",
        action_type: "code",
        suggested_action: "Investigate",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
        thread: null,
      },
    ]);

    expect(output).not.toContain("Day ");
    expect(output).not.toContain("Note:");
    expect(output).not.toContain("ongoing since");
  });

  it("does not show Day line when thread day_count is 1", () => {
    const output = formatBriefing([
      {
        severity: "notable",
        summary: "new event detected",
        action_type: "code",
        suggested_action: "Review",
        correlation_hint: null,
        related_events: [],
        confidence: "high",
        thread: {
          thread_id: "thread-ghi",
          day_count: 1,
          first_detected_at: "2026-04-03T10:00:00Z",
          latest_annotation: null,
        },
      },
    ]);

    expect(output).not.toContain("Day ");
    expect(output).not.toContain("ongoing since");
    // But thread_id should still be shown for annotation
    expect(output).toContain("Thread: thread-ghi");
  });

  it("shows thread_id so agent can call annotate_thread", () => {
    const output = formatBriefing([
      {
        severity: "critical",
        summary: "signup dropped 42%",
        action_type: "code",
        suggested_action: "Investigate",
        correlation_hint: null,
        related_events: ["signup"],
        confidence: "high",
        thread: {
          thread_id: "t-abc-123",
          day_count: 3,
          first_detected_at: "2026-04-01T08:00:00Z",
          latest_annotation: null,
        },
      },
    ]);

    expect(output).toContain("Thread: t-abc-123");
  });
});
