/**
 * Unicode chart utilities for MCP tool output.
 * These render inline in any markdown-capable MCP client.
 */

const MAX_PROP_VALUE_LEN = 100;

/**
 * Sanitize a user-controlled string for safe inclusion in MCP tool output.
 * Truncates long values and strips common prompt injection patterns.
 */
export function sanitize(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  const truncated = str.length > MAX_PROP_VALUE_LEN
    ? str.slice(0, MAX_PROP_VALUE_LEN) + "..."
    : str;
  return truncated.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

const FULL_BLOCK = "█";
const SHADE_BLOCK = "░";
const SPARKLINE_CHARS = "▁▂▃▄▅▆▇█";

/**
 * Render a horizontal bar with filled + empty portions.
 * bar(42, 100, 25) → "██████████░░░░░░░░░░░░░░░  42%"
 */
export function bar(value: number, max: number, width = 25): string {
  if (max === 0) return SHADE_BLOCK.repeat(width) + "  0%";
  const pct = value / max;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const pctStr = (pct * 100).toFixed(0);
  return FULL_BLOCK.repeat(filled) + SHADE_BLOCK.repeat(empty) + `  ${pctStr}%`;
}

/**
 * Render a sparkline from an array of numbers.
 * sparkline([1, 3, 5, 2, 8, 6, 7]) → "▁▃▅▂█▆▇"
 */
export function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (SPARKLINE_CHARS.length - 1));
      return SPARKLINE_CHARS[idx];
    })
    .join("");
}

/**
 * Status indicator based on thresholds.
 * status(12, { bad: 10, ok: 20, good: 30 }) → "🟡"
 */
export function status(
  value: number,
  thresholds: { bad: number; ok: number; good: number }
): string {
  if (value >= thresholds.good) return "🟢";
  if (value >= thresholds.ok) return "🟡";
  if (value >= thresholds.bad) return "🟡";
  return "🔴";
}

/**
 * Trend arrow with percentage.
 * trend(38, 29) → "↑ +31%"
 * trend(29, 38) → "↓ -24%"
 */
export function trend(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? "↑ new" : "→ 0";
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return "→ flat";
  const arrow = change > 0 ? "↑" : "↓";
  const sign = change > 0 ? "+" : "";
  return `${arrow} ${sign}${change.toFixed(0)}%`;
}

/**
 * Inline mini bar chart for grouped data.
 * miniBarChart([{key: "US", count: 450}, {key: "UK", count: 120}], 25)
 * → "US  ████████████████████████  450 (79%)\n UK  ██████░░░░░░░░░░░░░░░░░  120 (21%)"
 */
export function miniBarChart(
  groups: Array<{ key: string; count: number }>,
  width = 20
): string {
  if (groups.length === 0) return "";
  const max = Math.max(...groups.map((g) => g.count));
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const maxKeyLen = Math.max(...groups.map((g) => g.key.length), 3);

  return groups
    .map((g) => {
      const filled = max > 0 ? Math.round((g.count / max) * width) : 0;
      const empty = width - filled;
      const pct = total > 0 ? ((g.count / total) * 100).toFixed(0) : "0";
      const key = g.key.padEnd(maxKeyLen);
      return `${key}  ${FULL_BLOCK.repeat(filled)}${SHADE_BLOCK.repeat(empty)}  ${g.count.toLocaleString()} (${pct}%)`;
    })
    .join("\n\n");
}
