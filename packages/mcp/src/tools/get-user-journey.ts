import { z } from "zod";
import type { ApiClient } from "../api-client.js";
import { miniBarChart, sanitize } from "../charts.js";
import { getTip } from "../tips.js";

export const getUserJourneySchema = {
  user_id: z.string().describe("The user ID to look up"),
  time_range: z
    .string()
    .optional()
    .describe(
      'Time range to filter events: "last_24h", "last_7d", "last_30d", or ISO range'
    ),
  limit: z
    .number()
    .optional()
    .describe("Max events to return (default 50, max 200)"),
};

export type GetUserJourneyInput = z.infer<
  z.ZodObject<typeof getUserJourneySchema>
>;

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

export async function handleGetUserJourney(
  client: ApiClient,
  input: GetUserJourneyInput
): Promise<string> {
  const result = await client.getUserJourney({
    userId: input.user_id,
    timeRange: input.time_range,
    limit: input.limit,
  });

  const chart: string[] = [];

  if (result.warning) {
    chart.push(`⚠️ ${result.warning}`);
    chart.push("");
  }

  chart.push(`User Journey: ${input.user_id}`);
  if (input.time_range) {
    chart.push(`Time range: ${input.time_range}`);
  }
  chart.push(`${"─".repeat(50)}`);
  chart.push(`Events: ${result.events.length}`);

  if (result.events.length === 0) {
    chart.push("");
    chart.push(
      "No events found for this user. Check that the user ID is correct"
    );
    chart.push("and that events have been tracked.");
    return "Present this to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```";
  }

  chart.push("");

  // Group events into sessions (30min gap)
  const sessions: Array<{
    events: typeof result.events;
    start: Date;
    end: Date;
  }> = [];
  let currentSession: typeof result.events = [];
  let lastTime: Date | null = null;

  for (const event of result.events) {
    const time = new Date(event.timestamp);
    if (lastTime && time.getTime() - lastTime.getTime() > SESSION_GAP_MS) {
      if (currentSession.length > 0) {
        sessions.push({
          events: currentSession,
          start: new Date(currentSession[0]!.timestamp),
          end: new Date(currentSession[currentSession.length - 1]!.timestamp),
        });
      }
      currentSession = [];
    }
    currentSession.push(event);
    lastTime = time;
  }
  if (currentSession.length > 0) {
    sessions.push({
      events: currentSession,
      start: new Date(currentSession[0]!.timestamp),
      end: new Date(currentSession[currentSession.length - 1]!.timestamp),
    });
  }

  // Render sessions
  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]!;
    const duration = Math.round(
      (session.end.getTime() - session.start.getTime()) / 60000
    );
    const dateStr = session.start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = session.start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const durationStr =
      duration < 1 ? "<1 min" : duration < 60 ? `${duration} min` : `${(duration / 60).toFixed(1)} hrs`;

    chart.push(
      `Session ${i + 1} — ${dateStr} ${timeStr} (${durationStr}, ${session.events.length} events)`
    );

    for (const event of session.events) {
      const ts = new Date(event.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const propsEntries = Object.entries(event.properties).filter(
        ([, v]) => v !== null
      );
      let propStr = "";
      if (propsEntries.length > 0) {
        const formatted = propsEntries
          .slice(0, 3) // show max 3 props inline
          .map(([k, v]) => `${sanitize(k)}=${sanitize(v)}`)
          .join(", ");
        const more = propsEntries.length > 3 ? ` +${propsEntries.length - 3} more` : "";
        propStr = ` — ${formatted}${more}`;
      }

      // Icon by event type
      let icon = "·";
      if (event.event_name === "error") icon = "✗";
      else if (event.event_name === "page_view") icon = "○";
      else if (event.event_name === "click") icon = "●";
      else if (event.event_name === "form_submit") icon = "▸";
      else if (event.event_name === "session_start") icon = "▶";
      else if (event.event_name.includes("signup") || event.event_name.includes("register")) icon = "✓";
      else if (event.event_name.includes("purchase") || event.event_name.includes("pay")) icon = "$";

      chart.push(`  ${ts}  ${icon} ${event.event_name}${propStr}`);
    }
    chart.push("");
  }

  // Event frequency summary with bar chart
  const eventCounts = new Map<string, number>();
  for (const event of result.events) {
    eventCounts.set(
      event.event_name,
      (eventCounts.get(event.event_name) ?? 0) + 1
    );
  }
  const sorted = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);

  chart.push("Event Frequency");
  chart.push(
    miniBarChart(sorted.map(([key, count]) => ({ key, count })))
  );

  // Time span
  if (result.events.length >= 2) {
    const first = new Date(result.events[0]!.timestamp);
    const last = new Date(result.events[result.events.length - 1]!.timestamp);
    const spanMs = Math.abs(last.getTime() - first.getTime());
    const spanDays = spanMs / (1000 * 60 * 60 * 24);

    chart.push("");
    if (spanDays < 1) {
      chart.push(`Total span: ${(spanMs / 60000).toFixed(0)} minutes across ${sessions.length} session(s)`);
    } else {
      chart.push(`Total span: ${spanDays.toFixed(1)} days across ${sessions.length} session(s)`);
    }
  }

  const output = "Present this chart to the user exactly as-is:\n\n```\n" + chart.join("\n") + "\n```" + getTip("afterJourney");

  return output;
}
