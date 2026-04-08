import type { ApiClient } from "../api-client.js";

export const getProjectSummarySchema = {};

// Interfaces match the shapes written by wiki-compiler.ts in packages/api

interface KeyMetrics {
  total_events_30d: number;
  unique_users_30d: number;
  daily_active_avg: number;
  error_rate_pct: number;
  events_trend_pct: number;
  users_trend_pct: number;
  health_score: number;
  active_issues: number;
}

interface EventEntry {
  event_name: string;
  category: string | null;
  count_30d: number;
  unique_users_30d: number;
  trend: "up" | "down" | "stable";
}

interface FunnelStep {
  from_event: string;
  to_event: string;
  conversion_pct: number;
  trend: "up" | "down" | "stable";
}

interface ThreadEntry {
  id: string;
  title: string;
  severity: string;
  day_count: number;
  insight_count: number;
  latest_annotation: string | null;
}

interface ProjectSections {
  key_metrics?: KeyMetrics;
  event_catalog?: EventEntry[];
  funnel_health?: FunnelStep[];
  active_threads?: ThreadEntry[];
}

export function formatProjectSummary(sections: ProjectSections): string {
  const chart: string[] = [];

  // HEALTH
  const km = sections.key_metrics;
  if (km) {
    const score = Math.max(0, Math.min(10, Math.round(km.health_score)));
    const filled = "●".repeat(score);
    const empty = "○".repeat(10 - score);
    chart.push(`HEALTH: ${filled}${empty} ${score}/10  (${km.active_issues} active issue${km.active_issues === 1 ? "" : "s"})`);
    chart.push("");
  }

  // KEY METRICS
  if (km) {
    chart.push("KEY METRICS (last 30 days)");

    const trend = (pct: number): string =>
      pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "flat";

    chart.push(`  Total events:  ${km.total_events_30d.toLocaleString()}  (${trend(km.events_trend_pct)} vs prior 30d)`);
    chart.push(`  Unique users:  ${km.unique_users_30d.toLocaleString()}  (${trend(km.users_trend_pct)})`);
    chart.push(`  Daily active:  ~${km.daily_active_avg.toLocaleString()}`);
    chart.push(`  Error rate:    ${km.error_rate_pct}%`);
    chart.push("");
  }

  // EVENT CATALOG
  const catalog = sections.event_catalog;
  if (catalog && catalog.length > 0) {
    chart.push(`EVENT CATALOG (${catalog.length} event${catalog.length === 1 ? "" : "s"} tracked)`);

    // Group by category
    const grouped: Record<string, string[]> = {};
    for (const e of catalog) {
      const cat = e.category ?? "uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      const arrow = e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : "→";
      grouped[cat]!.push(`${e.event_name} (${e.count_30d.toLocaleString()} ${arrow})`);
    }
    for (const [cat, events] of Object.entries(grouped)) {
      chart.push(`  ${cat}: ${events.join(", ")}`);
    }
    chart.push("");
  }

  // FUNNEL HEALTH
  const funnel = sections.funnel_health;
  if (funnel && funnel.length > 0) {
    chart.push("FUNNEL HEALTH");
    for (const step of funnel) {
      const warn = step.trend === "down" ? " ⚠️" : "";
      chart.push(`  ${step.from_event} → ${step.to_event}:  ${step.conversion_pct}% conversion${warn}`);
    }
    chart.push("");
  }

  // ACTIVE THREADS
  const threads = sections.active_threads;
  if (threads && threads.length > 0) {
    chart.push(`ACTIVE THREADS (${threads.length})`);
    const severityDot: Record<string, string> = {
      critical: "🔴",
      notable: "🟡",
      informational: "🔵",
    };
    for (const t of threads) {
      const dot = severityDot[t.severity] ?? "⚪";
      const dayLabel = t.day_count > 1 ? ` (${t.day_count} days)` : "";
      chart.push(`  ${dot} ${t.title}${dayLabel}`);
      if (t.latest_annotation) {
        chart.push(`       ↳ ${t.latest_annotation}`);
      }
    }
    chart.push("");
  }

  return chart.join("\n");
}

export async function handleGetProjectSummary(
  client: ApiClient,
): Promise<string> {
  const data = await client.getProjectSummary();

  if (data.message) {
    return data.message;
  }

  if (!data.compiled_at) {
    return "No project summary available yet. Summaries are compiled hourly after events start flowing.";
  }

  const body = formatProjectSummary(data.sections as ProjectSections);

  const output = [
    "Present this project summary to the user exactly as-is:",
    "",
    "```",
    body,
    "```",
    "",
    `Last compiled: ${data.compiled_at}`,
    "",
    "Use get_insights for detailed alerts, or query specific events with get_event_counts.",
  ].join("\n");

  return output;
}
