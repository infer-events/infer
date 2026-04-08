import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import { filterSchema } from "@inferevents/shared";
import { miniBarChart, trend } from "../charts.js";
import { getTip } from "../tips.js";

export const getEventCountsSchema = {
  event_name: z
    .string()
    .describe(
      "Name of the event to count (e.g., 'signup', 'page_view', 'purchase')"
    ),
  time_range: z
    .string()
    .describe(
      'Time range: "last_24h", "last_7d", "last_30d", "last_90d", or ISO range "2024-01-01/2024-01-31"'
    ),
  group_by: z
    .string()
    .optional()
    .describe(
      "Property name to group results by (e.g., 'country', 'plan', 'source')"
    ),
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters: [{field, op, value}]"),
};

export type GetEventCountsInput = z.infer<
  z.ZodObject<typeof getEventCountsSchema>
>;

export async function handleGetEventCounts(
  client: ApiClient,
  input: GetEventCountsInput
): Promise<string> {
  const result = await client.getEventCounts({
    eventName: input.event_name,
    timeRange: input.time_range,
    groupBy: input.group_by,
    filters: input.filters,
  });

  const chart: string[] = [];

  if (result.warning) {
    chart.push(`⚠️ ${result.warning}`);
    chart.push("");
  }

  chart.push(`${input.event_name} — ${input.time_range}`);
  chart.push(`${"─".repeat(50)}`);
  chart.push(`Total: ${result.total.toLocaleString()}`);

  if (result.groups.length > 0 && input.group_by) {
    chart.push("");
    chart.push(`Grouped by ${input.group_by}:`);
    chart.push("");
    chart.push(
      miniBarChart(
        result.groups.map((g) => ({ key: g.key, count: g.count }))
      )
    );
  }

  if (result.total === 0) {
    chart.push("");
    chart.push(
      "No events found. The event may not be tracked, the name may be"
    );
    chart.push(
      "misspelled, or there was no activity in this time range."
    );
  }

  const output = "Present this chart to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```" + getTip("afterCounts");

  return output;
}
