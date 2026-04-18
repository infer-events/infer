import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export const getProjectSummarySchema = {};

type Sections = Record<string, unknown>;

function renderLlmObsSections(sections: Sections, lines: string[]): boolean {
  let rendered = false;

  const dist = sections.model_distribution as Record<string, number> | undefined;
  if (dist && Object.keys(dist).length > 0) {
    lines.push("Model distribution (last 7d)");
    const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
    for (const [model, share] of sorted) {
      lines.push(`  ${(share * 100).toFixed(1).padStart(5)}%  ${model}`);
    }
    lines.push("");
    rendered = true;
  }

  const spend = sections.weekly_spend_usd;
  if (typeof spend === "number") {
    lines.push(`Weekly spend: $${spend.toFixed(2)}`);
    rendered = true;
  }

  const errorRate = sections.error_rate_7d;
  if (typeof errorRate === "number") {
    lines.push(`Error rate (7d): ${(errorRate * 100).toFixed(1)}%`);
    rendered = true;
  }

  if (typeof spend === "number" || typeof errorRate === "number") lines.push("");

  const threads = sections.anomaly_threads as Array<{ thread_id: string; title: string; day_count: number }> | undefined;
  if (threads && threads.length > 0) {
    lines.push(`Active anomaly threads: ${threads.length}`);
    for (const t of threads) {
      lines.push(`  • ${t.title} — day ${t.day_count} (trace_id=${t.thread_id})`);
    }
    lines.push("");
    rendered = true;
  }

  return rendered;
}

function renderLegacySections(sections: Sections, lines: string[]): void {
  const events = sections.event_catalog as Array<{ name: string; count: number }> | undefined;
  if (events && events.length > 0) {
    lines.push("Event catalog (legacy)");
    for (const e of events.slice(0, 10)) {
      lines.push(`  ${e.count.toString().padStart(8)} ${e.name}`);
    }
    lines.push("");
  }

  const funnel = sections.funnel_performance as Record<string, number> | undefined;
  if (funnel) {
    lines.push("Funnel performance (legacy)");
    for (const [stage, rate] of Object.entries(funnel)) {
      lines.push(`  ${stage.padEnd(16)} ${(rate * 100).toFixed(1)}%`);
    }
    lines.push("");
  }
}

export async function handleGetProjectSummary(client: ApiClient): Promise<string> {
  const result = await client.getProjectSummary();

  const warnings: string[] = [];
  const caveats: string[] = [];

  if (result.compiled_at === null || !result.sections || Object.keys(result.sections).length === 0) {
    warnings.push(
      "Project summary has not been compiled yet. The wiki-compiler cron runs hourly; wait a bit and try again.",
    );
    return toolResponseText(
      wrapResult({
        primary: { rendered_text: "", compiled_at: null },
        source: "project_summary",
        warnings,
        caveats,
      }),
    );
  }

  const sections = result.sections as Sections;
  const lines: string[] = [
    `Project summary`,
    `Compiled: ${result.compiled_at}`,
    "─".repeat(60),
    "",
  ];

  const renderedLlmObs = renderLlmObsSections(sections, lines);
  if (!renderedLlmObs) {
    caveats.push(
      "Summary is in the legacy web-analytics shape. Phase 5 wiki-compiler rewrite will populate LLM-obs sections (model_distribution, weekly_spend_usd, error_rate_7d, anomaly_threads).",
    );
  }
  renderLegacySections(sections, lines);

  return toolResponseText(
    wrapResult({
      primary: {
        rendered_text: lines.join("\n"),
        compiled_at: result.compiled_at,
      },
      source: "project_summary",
      warnings,
      caveats,
    }),
  );
}
