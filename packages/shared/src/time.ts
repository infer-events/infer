import type { TimeRange, TimeRangeInput } from "./types.js";

export function resolveTimeRange(input: TimeRangeInput): TimeRange {
  if (typeof input === "object") {
    return input;
  }

  const now = new Date();
  const end = now.toISOString();

  const msPerDay = 24 * 60 * 60 * 1000;
  const offsets: Record<string, number> = {
    last_24h: 1 * msPerDay,
    last_7d: 7 * msPerDay,
    last_30d: 30 * msPerDay,
    last_90d: 90 * msPerDay,
  };

  const offset = offsets[input] ?? 0;
  const start = new Date(now.getTime() - offset).toISOString();

  return { start, end };
}
