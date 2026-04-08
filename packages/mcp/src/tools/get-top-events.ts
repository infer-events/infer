import { z } from "zod";
import type { TopEventsResult } from "@inferevents/shared";
import type { ApiClient } from "../api-client.js";
import { miniBarChart } from "../charts.js";
import { getTip } from "../tips.js";

export const getTopEventsSchema = {
  time_range: z
    .string()
    .describe(
      'Time range: "last_24h", "last_7d", "last_30d", "last_90d", or ISO range'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max number of events to return (default 20)"),
};

export async function handleGetTopEvents(
  client: ApiClient,
  params: { time_range: string; limit?: number }
): Promise<string> {
  const result = await client.getTopEvents({
    timeRange: params.time_range,
    limit: params.limit,
  });

  if (result.warning) {
    return `⚠️ ${result.warning}`;
  }

  if (result.events.length === 0) {
    return "❌ No events found in this time range.";
  }

  const totalEvents = result.events.reduce(
    (sum: number, e: { count: number }) => sum + e.count,
    0
  );

  const chart: string[] = [
    `Top Events — ${params.time_range}`,
    `${totalEvents.toLocaleString()} total events across ${result.total_event_names} types`,
    `${"─".repeat(50)}`,
    "",
    miniBarChart(
      result.events.map((e: { event_name: string; count: number }) => ({
        key: e.event_name,
        count: e.count,
      }))
    ),
    "",
    "Unique users per event:",
    "",
  ];

  // Build ASCII table for user stats
  const maxNameLen = Math.max(...result.events.map((e: { event_name: string }) => e.event_name.length), 5);
  chart.push(`${"Event".padEnd(maxNameLen)}  ${"Users".padStart(5)}  ${"Avg/User".padStart(8)}`);
  chart.push(`${"─".repeat(maxNameLen)}  ${"─".repeat(5)}  ${"─".repeat(8)}`);
  for (const e of result.events) {
    const ratio =
      e.count > 0 ? (e.count / e.unique_users).toFixed(1) : "0";
    chart.push(
      `${e.event_name.padEnd(maxNameLen)}  ${String(e.unique_users).padStart(5)}  ${ratio.padStart(8)}`
    );
  }

  // Available fields for group_by / filtering
  chart.push("");
  chart.push("Available fields for group_by:");
  chart.push("  Columns:  anonymous_id, user_id, event_type");
  chart.push("  Context:  browser, page_url, pathname, referrer, os, device_type, locale, timezone");
  chart.push("  Geo:      country, city, region, continent");
  chart.push("  Custom:   any key in event properties");

  // Guidance for missing custom events
  const autoTracked = [
    "page_view",
    "session_start",
    "click",
    "form_submit",
    "error",
  ];
  const customEvents = result.events.filter(
    (e: { event_name: string }) => !autoTracked.includes(e.event_name)
  );

  if (customEvents.length === 0) {
    chart.push("");
    chart.push(
      "Only auto-tracked events. No custom track() calls detected."
    );
    chart.push(
      "Add track() for key user actions (signup, purchase, feature usage)."
    );
  }

  // Wrap in code block so agents display it verbatim
  const output = "Present this chart to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```" + getTip("afterTopEvents");

  return output;
}
