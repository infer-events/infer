import { describe, it, expect } from "vitest";
import { PRICING_TABLE, lookupPricing, computeCostUsd } from "./pricing.js";

describe("PRICING_TABLE", () => {
  it("has a version string", () => {
    expect(typeof PRICING_TABLE.version).toBe("string");
    expect(PRICING_TABLE.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes openai gpt-4o", () => {
    expect(PRICING_TABLE.openai["gpt-4o"]).toBeDefined();
    expect(PRICING_TABLE.openai["gpt-4o"]!.input).toBeGreaterThan(0);
    expect(PRICING_TABLE.openai["gpt-4o"]!.output).toBeGreaterThan(0);
  });

  it("includes anthropic claude-sonnet-4-6", () => {
    expect(PRICING_TABLE.anthropic["claude-sonnet-4-6"]).toBeDefined();
  });
});

describe("lookupPricing", () => {
  it("returns pricing for a known model", () => {
    const p = lookupPricing("openai", "gpt-4o");
    expect(p).not.toBeNull();
    expect(p!.input).toBeGreaterThan(0);
  });

  it("returns null for an unknown provider", () => {
    expect(lookupPricing("unknown-provider", "gpt-4o")).toBeNull();
  });

  it("returns null for an unknown model", () => {
    expect(lookupPricing("openai", "gpt-9000")).toBeNull();
  });
});

describe("computeCostUsd", () => {
  it("computes cost for known model", () => {
    const cost = computeCostUsd("openai", "gpt-4o", 1000, 500);
    expect(cost).not.toBeNull();
    expect(cost!).toBeCloseTo(0.0075, 6);
  });

  it("returns null when model is not in table", () => {
    expect(computeCostUsd("openai", "gpt-nonexistent", 100, 50)).toBeNull();
  });

  it("returns null when input tokens is null", () => {
    expect(computeCostUsd("openai", "gpt-4o", null, 500)).toBeNull();
  });

  it("returns null when output tokens is null", () => {
    expect(computeCostUsd("openai", "gpt-4o", 100, null)).toBeNull();
  });

  it("treats ollama as zero-cost", () => {
    expect(computeCostUsd("ollama", "llama3.1", 1000, 1000)).toBe(0);
  });
});
