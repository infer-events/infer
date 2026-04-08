import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import { bar, status } from "../charts.js";
import { getTip } from "../tips.js";

export const getRetentionSchema = {
  start_event: z
    .string()
    .describe(
      'The event that defines cohort entry (e.g., "signup", "first_purchase")'
    ),
  return_event: z
    .string()
    .describe(
      'The event that counts as a return (e.g., "page_view", "purchase", "login")'
    ),
  time_range: z
    .string()
    .describe(
      'Time range: "last_7d", "last_30d", "last_90d", or ISO range "2024-01-01/2024-03-31"'
    ),
  granularity: z
    .enum(["day", "week", "month"])
    .describe('Cohort granularity: "day", "week", or "month"'),
};

export type GetRetentionInput = z.infer<
  z.ZodObject<typeof getRetentionSchema>
>;

// B2C weekly benchmarks for status indicators
const B2C_BENCHMARKS: Record<number, { bad: number; ok: number; good: number }> = {
  1: { bad: 15, ok: 25, good: 35 },
  2: { bad: 10, ok: 18, good: 28 },
  3: { bad: 8, ok: 14, good: 24 },
  4: { bad: 5, ok: 10, good: 20 },
};

export async function handleGetRetention(
  client: ApiClient,
  input: GetRetentionInput
): Promise<string> {
  const result = await client.getRetention({
    startEvent: input.start_event,
    returnEvent: input.return_event,
    timeRange: input.time_range,
    granularity: input.granularity,
  });

  const chart: string[] = [];

  if (result.warning) {
    chart.push(`⚠️ ${result.warning}`);
    chart.push("");
  }

  chart.push(`Retention: ${input.start_event} → ${input.return_event}`);
  chart.push(`${input.granularity}ly cohorts | ${input.time_range}`);
  chart.push(`${"─".repeat(50)}`);

  if (result.cohorts.length === 0) {
    chart.push(
      "No cohort data found. Check that both events are being tracked"
    );
    chart.push("and that there is activity in this time range.");
    return "Present this to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```";
  }

  chart.push("");

  // Visual retention chart per cohort
  for (const cohort of result.cohorts) {
    const label = new Date(cohort.period).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    chart.push(`${label} (${cohort.users_start} users)`);

    for (let i = 0; i < cohort.retained.length; i++) {
      const retained = cohort.retained[i]!;
      const pct =
        cohort.users_start > 0
          ? (retained / cohort.users_start) * 100
          : 0;
      const periodLabel = `${input.granularity} ${i}`;

      // Get status indicator for weekly benchmarks
      let statusIcon = "";
      if (input.granularity === "week" && i > 0 && B2C_BENCHMARKS[i]) {
        statusIcon = " " + status(pct, B2C_BENCHMARKS[i]!);
      }

      chart.push(
        `  ${periodLabel.padEnd(10)} ${bar(retained, cohort.users_start)}${statusIcon}`
      );
    }
    chart.push("");
  }

  // Overall summary
  const totalUsers = result.cohorts.reduce(
    (sum, c) => sum + c.users_start,
    0
  );

  // Calculate blended retention for the latest complete period
  const completeCohorts = result.cohorts.filter(
    (c) => c.retained.length > 1
  );
  if (completeCohorts.length > 0) {
    const period1Retained = completeCohorts.reduce(
      (sum, c) => sum + (c.retained[1] ?? 0),
      0
    );
    const period1Total = completeCohorts.reduce(
      (sum, c) => sum + c.users_start,
      0
    );
    const blendedPct =
      period1Total > 0
        ? ((period1Retained / period1Total) * 100).toFixed(1)
        : "N/A";

    chart.push(
      `Blended ${input.granularity}-1 retention: ${blendedPct}% across ${totalUsers} total users`
    );
  }

  if (totalUsers < 30) {
    chart.push("");
    chart.push(
      `⚠️ Small sample (${totalUsers} users). Treat as directional, not conclusive.`
    );
  }

  const output = "Present this chart to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```" + getTip("afterRetention");

  return output;
}
