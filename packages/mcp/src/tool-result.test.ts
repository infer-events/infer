import { describe, it, expect } from "vitest";
import { wrapResult, type ToolResultSource } from "./tool-result.js";

describe("wrapResult", () => {
  it("wraps a primary payload with the §7.2 envelope and an ISO8601 as_of", () => {
    const out = wrapResult({
      primary: { foo: 1 },
      source: "spans",
    });
    expect(out.primary).toEqual({ foo: 1 });
    expect(out.warnings).toEqual([]);
    expect(out.caveats).toEqual([]);
    expect(out.source).toBe("spans");
    expect(() => new Date(out.as_of)).not.toThrow();
    expect(out.as_of).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("preserves caller-supplied warnings and caveats", () => {
    const out = wrapResult({
      primary: [],
      warnings: ["sample size below 10"],
      caveats: ["based on 7-day baseline"],
      source: "spans",
    });
    expect(out.warnings).toEqual(["sample size below 10"]);
    expect(out.caveats).toEqual(["based on 7-day baseline"]);
  });

  it("accepts every defined source type without TypeScript error", () => {
    const sources: ToolResultSource[] = [
      "spans",
      "insights",
      "annotations",
      "project_summary",
      "config",
      "pricing_table",
    ];
    for (const source of sources) {
      const out = wrapResult({ primary: {}, source });
      expect(out.source).toBe(source);
    }
  });

  it("allows a fixed as_of override for test determinism", () => {
    const fixed = "2026-04-18T12:00:00.000Z";
    const out = wrapResult({
      primary: {},
      source: "spans",
      asOf: fixed,
    });
    expect(out.as_of).toBe(fixed);
  });

  it("clones caller-supplied warnings/caveats so later mutation doesn't leak into the envelope", () => {
    const callerWarnings = ["initial"];
    const callerCaveats = ["initial-caveat"];
    const out = wrapResult({
      primary: {},
      source: "spans",
      warnings: callerWarnings,
      caveats: callerCaveats,
    });
    callerWarnings.push("late-add");
    callerCaveats.push("late-caveat");
    expect(out.warnings).toEqual(["initial"]);
    expect(out.caveats).toEqual(["initial-caveat"]);
  });

  it("formats the output as a JSON-in-text string via toolResponseText()", async () => {
    const { toolResponseText } = await import("./tool-result.js");
    const envelope = wrapResult({
      primary: { count: 42 },
      source: "spans",
      asOf: "2026-04-18T12:00:00.000Z",
    });
    const text = toolResponseText(envelope);
    const parsed = JSON.parse(text);
    expect(parsed.primary).toEqual({ count: 42 });
    expect(parsed.source).toBe("spans");
  });
});
