import { describe, it, expect, vi } from "vitest";
import { handleAnnotateTrace } from "./annotate-trace.js";

describe("handleAnnotateTrace", () => {
  it("returns annotation_id in the envelope", async () => {
    const client = { annotateTrace: vi.fn().mockResolvedValue({ annotation_id: "ann_t" }) } as const;
    const parsed = JSON.parse(await handleAnnotateTrace(client as never, { trace_id: "t1", content: "diagnosis" }));
    expect(parsed.primary.annotation_id).toBe("ann_t");
    expect(parsed.source).toBe("annotations");
  });
});
