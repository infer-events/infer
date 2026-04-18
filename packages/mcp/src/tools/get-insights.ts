import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export const getInsightsSchema = {
  severity: z
    .enum(["critical", "notable", "informational"])
    .optional()
    .describe("Filter by severity level. Omit to get all unacknowledged insights."),
};

type Evidence = Record<string, unknown>;

interface Insight {
  id: string;
  type: string;
  name: string;
  summary: string;
  evidence: Evidence;
  severity: string;
  detected_at: string;
  action_type: string | null;
  suggested_action: string | null;
  correlation_hint: string | null;
  related_events: string[];
  confidence: string;
  thread: {
    thread_id: string;
    title: string;
    day_count: number;
    first_detected_at: string;
    status: string;
    latest_annotation: string | null;
  } | null;
}

function isLlmObsShape(ev: Evidence): boolean {
  return typeof ev.provider === "string" || typeof ev.model === "string";
}

function renderEvidence(ev: Evidence): string {
  if (isLlmObsShape(ev)) {
    const parts: string[] = [];
    if (ev.provider) parts.push(`provider=${ev.provider}`);
    if (ev.model)    parts.push(`model=${ev.model}`);
    if (ev.feature)  parts.push(`feature=${ev.feature}`);
    for (const [k, v] of Object.entries(ev)) {
      if (["provider", "model", "feature"].includes(k)) continue;
      parts.push(`${k}=${typeof v === "number" ? v.toLocaleString() : v}`);
    }
    return parts.join(", ");
  }
  return Object.entries(ev)
    .slice(0, 6)
    .map(([k, v]) => `${k}=${typeof v === "number" ? v.toLocaleString() : v}`)
    .join(", ");
}

export async function handleGetInsights(
  client: ApiClient,
  params: { severity?: string },
): Promise<string> {
  const result = await client.getInsights({ severity: params.severity });

  const warnings: string[] = [];
  const caveats: string[] = [];

  if (result.count === 0) {
    warnings.push(
      "No new insights. Everything looks normal, or there isn't enough data yet (insights activate after first spans arrive).",
    );
    return toolResponseText(
      wrapResult({
        primary: { insights: [], count: 0, rendered_text: "" },
        source: "insights",
        warnings,
        caveats,
      }),
    );
  }

  const severityIcon: Record<string, string> = { critical: "!!", notable: "!", informational: "i" };

  const lines: string[] = [
    `${result.count} insight(s) — detected anomalies + notable patterns`,
    "─".repeat(60),
  ];

  const insights = result.insights as Insight[];
  for (const ins of insights) {
    const icon = severityIcon[ins.severity] ?? "?";
    lines.push(`[${icon}] ${ins.summary}`);
    const evLine = renderEvidence(ins.evidence);
    if (evLine) lines.push(`    ${evLine}`);

    if (ins.thread) {
      if (ins.thread.day_count > 1) {
        lines.push(`    Day ${ins.thread.day_count} — ongoing since ${ins.thread.first_detected_at.slice(0, 10)}`);
      }
      if (ins.thread.latest_annotation) {
        lines.push(`    Note: ${ins.thread.latest_annotation}`);
      }
      const annotateCall = isLlmObsShape(ins.evidence)
        ? `    → annotate_trace("${ins.thread.thread_id}", "<your finding>")`
        : `    → annotate_span("<span_id>", "<your finding>")`;
      lines.push(annotateCall);
    }

    if (ins.suggested_action) lines.push(`    Action: ${ins.suggested_action}`);
    if (ins.correlation_hint)  lines.push(`    Git hint: ${ins.correlation_hint}`);
    lines.push("");
  }

  caveats.push(
    "Insights are auto-detected hourly. annotate_trace / annotate_span the findings — they surface in future briefings and in get_project_summary.",
  );

  const legacyCount = insights.filter((i) => !isLlmObsShape(i.evidence)).length;
  if (legacyCount > 0) {
    caveats.push(
      `${legacyCount} insight(s) still use the legacy event-based schema. Phase 5 cron rewrite will migrate these to LLM-obs shape.`,
    );
  }

  return toolResponseText(
    wrapResult({
      primary: {
        insights,
        count: result.count,
        rendered_text: lines.join("\n"),
      },
      source: "insights",
      warnings,
      caveats,
    }),
  );
}
