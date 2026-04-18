import { describe, it, expect } from "vitest";
import { buildDeprecationShim } from "./deprecated.js";

describe("buildDeprecationShim", () => {
  it("returns a tool handler that emits the §8.4 deprecation envelope", async () => {
    const handler = buildDeprecationShim({
      toolName: "get_event_counts",
      replacementTools: ["list_spans", "get_token_usage"],
      sunsetOn: "2026-06-18",
      reason: "web-analytics events are no longer captured; LLM-obs spans have no direct analogue",
    });
    const out = await handler();
    expect(out.isError).toBe(true);
    const text = out.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.deprecated).toBe(true);
    expect(parsed.tool_name).toBe("get_event_counts");
    expect(parsed.sunset_on).toBe("2026-06-18");
    expect(parsed.replacement_tools).toEqual(["list_spans", "get_token_usage"]);
    expect(parsed.reason).toMatch(/web-analytics events/);
    expect(parsed.message).toMatch(/get_event_counts/);
    expect(parsed.message).toMatch(/list_spans/);
  });

  it("accepts empty replacement_tools for tools with no direct replacement", async () => {
    const handler = buildDeprecationShim({
      toolName: "update_ontology",
      replacementTools: [],
      sunsetOn: "2026-06-18",
      reason: "event ontology concept doesn't apply to LLM-obs data",
    });
    const out = await handler();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.replacement_tools).toEqual([]);
    expect(parsed.message).toMatch(/no direct replacement/);
  });

  it("validates sunset_on is ISO8601 YYYY-MM-DD", () => {
    expect(() =>
      buildDeprecationShim({
        toolName: "t",
        replacementTools: [],
        sunsetOn: "June 18, 2026",
        reason: "",
      })
    ).toThrow(/sunset_on/);
  });

  it("rejects structurally-valid but non-calendar dates (e.g. 9999-99-99, 2026-02-30)", () => {
    for (const bogus of ["9999-99-99", "2026-02-30", "2026-13-01", "2026-00-10"]) {
      expect(() =>
        buildDeprecationShim({
          toolName: "t",
          replacementTools: [],
          sunsetOn: bogus,
          reason: "",
        })
      ).toThrow(/real calendar date/);
    }
  });

  it("strips whitespace-only `reason` so the message doesn't read 'Reason:   '", async () => {
    const handler = buildDeprecationShim({
      toolName: "get_ontology",
      replacementTools: [],
      sunsetOn: "2026-06-17",
      reason: "   \t  ",
    });
    const out = await handler();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.message).not.toMatch(/Reason:/);
  });
});
