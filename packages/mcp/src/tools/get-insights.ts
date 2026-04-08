import { z } from "zod";
import type { ApiClient } from "../api-client.js";

export const getInsightsSchema = {
  severity: z
    .enum(["critical", "notable", "informational"])
    .optional()
    .describe("Filter by severity level. Omit to get all unacknowledged insights."),
};

export async function handleGetInsights(
  client: ApiClient,
  params: { severity?: string }
): Promise<string> {
  const result = await client.getInsights({
    severity: params.severity,
  });

  if (result.count === 0) {
    return "No new insights. Everything looks normal, or there isn't enough data yet (insights activate after first events are received).";
  }

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

  // Split into code actions and strategy actions
  const codeActions = result.insights.filter((i) => i.action_type === "code");
  const strategyActions = result.insights.filter((i) => i.action_type === "strategy");
  const unclassified = result.insights.filter((i) => !i.action_type);

  const chart: string[] = [
    `${result.count} items need your attention`,
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
      if (insight.suggested_action) {
        chart.push(`    Action: ${insight.suggested_action}`);
      }
      if (insight.correlation_hint) {
        chart.push(`    Git hint: ${insight.correlation_hint}`);
      }
      if (insight.related_events.length > 0) {
        chart.push(`    Events: ${insight.related_events.join(", ")}`);
      }
      if (thread) {
        chart.push(`    → annotate_thread("${thread.thread_id}", "<your finding>")`);
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
      const evidence = insight.evidence as Record<string, unknown>;
      const evidenceStr = Object.entries(evidence)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${typeof v === "number" ? v.toLocaleString() : v}`)
        .join(", ");
      if (evidenceStr) {
        chart.push(`    ${evidenceStr}`);
      }
      chart.push("");
    }
  }

  // Collect thread IDs for the annotation prompt
  const threadIds = result.insights
    .map((i) => i.thread?.thread_id)
    .filter((id): id is string => !!id);
  const hasThreads = threadIds.length > 0;

  const output = [
    // Directive at the TOP — agent reads this first
    ...(hasThreads
      ? [
          "REQUIRED WORKFLOW: For each insight below, (1) investigate using the Git hint and related events, (2) present findings to the user, (3) call annotate_thread(thread_id, content) with what you found. Step 3 is not optional — it makes future sessions smarter. Skip only if the thread already has an annotation that covers your finding.",
          "",
        ]
      : [
          "Present this briefing to the user exactly as-is. For CODE ACTIONS, use the Git hint to run `git log` and find related commits before presenting. Add the likely cause to each item.",
          "",
        ]),
    "```",
    ...chart,
    "```",
  ].join("\n");

  return output;
}
