import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  listSpansInputSchema,
  getTraceInputSchema,
  getSpanInputSchema,
  getLatencyStatsInputSchema,
  getTokenUsageInputSchema,
  getCostStatsInputSchema,
  getErrorSpansInputSchema,
  annotateSpanInputSchema,
  annotateTraceInputSchema,
} from "./schemas.js";

describe("tool input schemas", () => {
  describe("listSpansInputSchema", () => {
    it("accepts an empty object (all filters optional)", () => {
      expect(z.object(listSpansInputSchema).parse({})).toEqual({});
    });

    it("accepts every documented filter", () => {
      const parsed = z.object(listSpansInputSchema).parse({
        model: "gpt-4o-mini",
        user_id: "u_123",
        session_id: "s_456",
        time_window: "24h",
        tags: ["prod", "agent"],
        min_duration_ms: 1000,
        status_min: 200,
        status_max: 599,
        cursor: "eyJ0IjoiMjAyNi0wNC0xOFQxMjowMDowMFoiLCJzIjoic3Bhbl8xMjMifQ==",
        limit: 50,
      });
      expect(parsed.model).toBe("gpt-4o-mini");
      expect(parsed.limit).toBe(50);
      expect(parsed.tags).toEqual(["prod", "agent"]);
    });

    it("rejects project_id as an input key (spec §7.4)", () => {
      const keys = Object.keys(listSpansInputSchema);
      expect(keys).not.toContain("project_id");
    });

    it("bounds limit between 1 and 200", () => {
      expect(() => z.object(listSpansInputSchema).parse({ limit: 0 })).toThrow();
      expect(() => z.object(listSpansInputSchema).parse({ limit: 201 })).toThrow();
      expect(z.object(listSpansInputSchema).parse({ limit: 1 }).limit).toBe(1);
      expect(z.object(listSpansInputSchema).parse({ limit: 200 }).limit).toBe(200);
    });
  });

  describe("getTraceInputSchema", () => {
    it("requires trace_id", () => {
      expect(() => z.object(getTraceInputSchema).parse({})).toThrow(/trace_id/);
      expect(z.object(getTraceInputSchema).parse({ trace_id: "t_abc" }).trace_id).toBe("t_abc");
    });
  });

  describe("getSpanInputSchema", () => {
    it("requires span_id", () => {
      expect(() => z.object(getSpanInputSchema).parse({})).toThrow(/span_id/);
      expect(z.object(getSpanInputSchema).parse({ span_id: "s_abc" }).span_id).toBe("s_abc");
    });
  });

  describe("getLatencyStatsInputSchema", () => {
    it("requires dimension from the allowed set", () => {
      expect(() => z.object(getLatencyStatsInputSchema).parse({})).toThrow(/dimension/);
      expect(() =>
        z.object(getLatencyStatsInputSchema).parse({ dimension: "tenant" }),
      ).toThrow();
      expect(
        z.object(getLatencyStatsInputSchema).parse({ dimension: "model" }).dimension,
      ).toBe("model");
    });
  });

  describe("getTokenUsageInputSchema", () => {
    it("requires dimension + time_window", () => {
      expect(() => z.object(getTokenUsageInputSchema).parse({})).toThrow();
      const ok = z.object(getTokenUsageInputSchema).parse({
        dimension: "model",
        time_window: "7d",
      });
      expect(ok.dimension).toBe("model");
      expect(ok.time_window).toBe("7d");
    });
  });

  describe("getCostStatsInputSchema", () => {
    it("matches getTokenUsage shape", () => {
      const parsed = z.object(getCostStatsInputSchema).parse({
        dimension: "model",
        time_window: "24h",
      });
      expect(parsed.dimension).toBe("model");
    });
  });

  describe("getErrorSpansInputSchema", () => {
    it("accepts optional time_window and limit", () => {
      expect(z.object(getErrorSpansInputSchema).parse({})).toEqual({});
      const parsed = z.object(getErrorSpansInputSchema).parse({
        time_window: "24h",
        limit: 50,
        cursor: "abc",
      });
      expect(parsed.limit).toBe(50);
    });
  });

  describe("annotateSpanInputSchema", () => {
    it("requires span_id + content with content ≤ 2000 chars", () => {
      expect(() => z.object(annotateSpanInputSchema).parse({ span_id: "s_1" })).toThrow();
      const ok = z.object(annotateSpanInputSchema).parse({
        span_id: "s_1",
        content: "root cause identified",
      });
      expect(ok.content).toBe("root cause identified");
      expect(() =>
        z.object(annotateSpanInputSchema).parse({
          span_id: "s_1",
          content: "x".repeat(2001),
        }),
      ).toThrow();
    });
  });

  describe("annotateTraceInputSchema", () => {
    it("requires trace_id + content", () => {
      const ok = z.object(annotateTraceInputSchema).parse({
        trace_id: "t_1",
        content: "multi-iteration agent turn diagnosed",
      });
      expect(ok.trace_id).toBe("t_1");
    });
  });
});
