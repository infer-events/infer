import { describe, it, expect } from "vitest";
import { RETIRED_TOOL_SHIMS } from "./deprecated-tools.js";

describe("retired tool shims", () => {
  it("registers the 6 retired web-analytics tools + annotate_thread split shim", () => {
    expect(Object.keys(RETIRED_TOOL_SHIMS).sort()).toEqual([
      "annotate_thread",
      "get_event_counts",
      "get_ontology",
      "get_retention",
      "get_top_events",
      "get_user_journey",
      "update_ontology",
    ]);
  });

  it("every shim emits isError=true with a parseable deprecation envelope", async () => {
    for (const [toolName, entry] of Object.entries(RETIRED_TOOL_SHIMS)) {
      const out = await entry.handler();
      expect(out.isError).toBe(true);
      const parsed = JSON.parse(out.content[0].text);
      expect(parsed.deprecated).toBe(true);
      expect(parsed.tool_name).toBe(toolName);
      expect(parsed.sunset_on).toBe("2026-06-17");
      expect(Array.isArray(parsed.replacement_tools)).toBe(true);
    }
  });

  it("get_event_counts points at list_spans + get_token_usage", async () => {
    const out = await RETIRED_TOOL_SHIMS.get_event_counts!.handler();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.replacement_tools).toEqual(["list_spans", "get_token_usage"]);
  });

  it("get_user_journey points at get_trace", async () => {
    const out = await RETIRED_TOOL_SHIMS.get_user_journey!.handler();
    const parsed = JSON.parse(out.content[0].text);
    expect(parsed.replacement_tools).toEqual(["get_trace", "list_spans"]);
  });

  it("ontology tools point at no direct replacement (LLM-obs has no ontology concept)", async () => {
    for (const name of ["get_ontology", "update_ontology"] as const) {
      const out = await RETIRED_TOOL_SHIMS[name]!.handler();
      const parsed = JSON.parse(out.content[0].text);
      expect(parsed.replacement_tools).toEqual([]);
    }
  });
});
