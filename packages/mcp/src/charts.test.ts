import { describe, it, expect } from "vitest";
import { sanitize, bar, sparkline, status, trend, miniBarChart } from "./charts.js";

describe("sanitize", () => {
  it("returns short strings as-is", () => {
    expect(sanitize("hello world")).toBe("hello world");
  });

  it("truncates strings over 100 chars with ellipsis", () => {
    const long = "a".repeat(120);
    const result = sanitize(long);
    expect(result).toHaveLength(103); // 100 + "..."
    expect(result.endsWith("...")).toBe(true);
    expect(result.startsWith("a".repeat(100))).toBe(true);
  });

  it("returns exactly 100-char strings without truncation", () => {
    const exact = "b".repeat(100);
    expect(sanitize(exact)).toBe(exact);
  });

  it("strips control characters", () => {
    const withControl = "hello\x00world\x08test\x1F";
    expect(sanitize(withControl)).toBe("helloworldtest");
  });

  it("preserves newlines and tabs (allowed whitespace)", () => {
    // \n is \x0A, \t is \x09 — both outside the stripped range
    expect(sanitize("line1\nline2\ttab")).toBe("line1\nline2\ttab");
  });

  it("converts numbers via JSON.stringify", () => {
    expect(sanitize(42)).toBe("42");
    expect(sanitize(3.14)).toBe("3.14");
  });

  it("converts objects via JSON.stringify", () => {
    expect(sanitize({ key: "val" })).toBe('{"key":"val"}');
  });

  it("converts arrays via JSON.stringify", () => {
    expect(sanitize([1, 2, 3])).toBe("[1,2,3]");
  });

  it("handles null", () => {
    expect(sanitize(null)).toBe("null");
  });

  it("handles undefined", () => {
    // JSON.stringify(undefined) returns undefined, ?? "" catches it
    expect(sanitize(undefined)).toBe("");
  });
});

describe("bar", () => {
  it("renders correct filled/empty ratio for 50%", () => {
    const result = bar(50, 100, 20);
    const filled = (result.match(/█/g) || []).length;
    const empty = (result.match(/░/g) || []).length;
    expect(filled).toBe(10);
    expect(empty).toBe(10);
    expect(result).toContain("50%");
  });

  it("renders all empty for 0%", () => {
    const result = bar(0, 100, 20);
    const filled = (result.match(/█/g) || []).length;
    const empty = (result.match(/░/g) || []).length;
    expect(filled).toBe(0);
    expect(empty).toBe(20);
    expect(result).toContain("0%");
  });

  it("renders all filled for 100%", () => {
    const result = bar(100, 100, 20);
    const filled = (result.match(/█/g) || []).length;
    const empty = (result.match(/░/g) || []).length;
    expect(filled).toBe(20);
    expect(empty).toBe(0);
    expect(result).toContain("100%");
  });

  it("handles max=0 gracefully", () => {
    const result = bar(0, 0, 20);
    const empty = (result.match(/░/g) || []).length;
    expect(empty).toBe(20);
    expect(result).toContain("0%");
  });

  it("uses default width of 25", () => {
    const result = bar(100, 100);
    const filled = (result.match(/█/g) || []).length;
    expect(filled).toBe(25);
  });

  it("respects custom width parameter", () => {
    const result = bar(100, 100, 10);
    const filled = (result.match(/█/g) || []).length;
    expect(filled).toBe(10);
  });
});

describe("sparkline", () => {
  it("renders sparkline characters for varying values", () => {
    const result = sparkline([1, 3, 5, 2, 8, 6, 7]);
    expect(result).toHaveLength(7);
    // Each character should be a valid sparkline char
    for (const ch of result) {
      expect("▁▂▃▄▅▆▇█").toContain(ch);
    }
  });

  it("uses lowest char for min and highest char for max", () => {
    const result = sparkline([0, 100]);
    expect(result[0]).toBe("▁");
    expect(result[1]).toBe("█");
  });

  it("returns empty string for empty array", () => {
    expect(sparkline([])).toBe("");
  });

  it("handles single value", () => {
    const result = sparkline([5]);
    expect(result).toHaveLength(1);
    expect("▁▂▃▄▅▆▇█").toContain(result);
  });

  it("handles all same values (flat line)", () => {
    const result = sparkline([5, 5, 5, 5]);
    expect(result).toHaveLength(4);
    // When range is 0, all values map to the same index
    const firstChar = result[0];
    expect(result).toBe(firstChar!.repeat(4));
  });
});

describe("status", () => {
  const thresholds = { bad: 10, ok: 20, good: 30 };

  it("returns green circle for values >= good threshold", () => {
    expect(status(30, thresholds)).toBe("🟢");
    expect(status(50, thresholds)).toBe("🟢");
  });

  it("returns yellow circle for values between ok and good", () => {
    expect(status(25, thresholds)).toBe("🟡");
    expect(status(20, thresholds)).toBe("🟡");
  });

  it("returns yellow circle for values between bad and ok", () => {
    expect(status(15, thresholds)).toBe("🟡");
    expect(status(10, thresholds)).toBe("🟡");
  });

  it("returns red circle for values below bad threshold", () => {
    expect(status(5, thresholds)).toBe("🔴");
    expect(status(0, thresholds)).toBe("🔴");
    expect(status(9, thresholds)).toBe("🔴");
  });
});

describe("trend", () => {
  it("shows up arrow with positive percentage", () => {
    const result = trend(38, 29);
    expect(result).toContain("↑");
    expect(result).toContain("+31%");
  });

  it("shows down arrow with negative percentage", () => {
    const result = trend(29, 38);
    expect(result).toContain("↓");
    expect(result).toContain("-24%");
  });

  it('shows flat arrow for <1% change', () => {
    const result = trend(100, 100);
    expect(result).toBe("→ flat");
  });

  it('shows "new" when previous is 0 and current > 0', () => {
    const result = trend(10, 0);
    expect(result).toBe("↑ new");
  });

  it('shows "0" when both are 0', () => {
    const result = trend(0, 0);
    expect(result).toBe("→ 0");
  });

  it("handles very small but non-trivial changes", () => {
    // 1% change exactly: (101 - 100) / 100 * 100 = 1%
    const result = trend(101, 100);
    expect(result).toContain("↑");
    expect(result).toContain("+1%");
  });
});

describe("miniBarChart", () => {
  it("renders grouped bars with labels and percentages", () => {
    const result = miniBarChart(
      [
        { key: "US", count: 450 },
        { key: "UK", count: 120 },
      ],
      20,
    );
    expect(result).toContain("US");
    expect(result).toContain("UK");
    expect(result).toContain("450");
    expect(result).toContain("120");
    // Should have percentage labels
    expect(result).toMatch(/\d+%/);
  });

  it("returns empty string for empty groups", () => {
    expect(miniBarChart([])).toBe("");
  });

  it("separates groups with double newlines", () => {
    const result = miniBarChart([
      { key: "A", count: 10 },
      { key: "B", count: 20 },
    ]);
    expect(result).toContain("\n\n");
  });

  it("pads keys to align bars", () => {
    const result = miniBarChart([
      { key: "Short", count: 10 },
      { key: "LongerKey", count: 20 },
    ]);
    const lines = result.split("\n\n");
    // Both lines should have the key padded to the same length before the bar
    const firstKeySection = lines[0]!.split("█")[0]!.split("░")[0]!;
    const secondKeySection = lines[1]!.split("█")[0]!.split("░")[0]!;
    expect(firstKeySection.length).toBe(secondKeySection.length);
  });

  it("handles single group", () => {
    const result = miniBarChart([{ key: "Only", count: 100 }], 10);
    expect(result).toContain("Only");
    expect(result).toContain("100%");
    // Full bar for the only group
    const filled = (result.match(/█/g) || []).length;
    expect(filled).toBe(10);
  });

  it("handles all-zero counts", () => {
    const result = miniBarChart([
      { key: "A", count: 0 },
      { key: "B", count: 0 },
    ]);
    expect(result).toContain("0%");
    // No filled blocks when max is 0
    expect(result).not.toContain("█");
  });
});
