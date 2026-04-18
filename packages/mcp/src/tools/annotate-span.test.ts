import { describe, it, expect, vi } from "vitest";
import { handleAnnotateSpan } from "./annotate-span.js";

describe("handleAnnotateSpan", () => {
  it("returns the annotation_id in the wrapped envelope", async () => {
    const client = { annotateSpan: vi.fn().mockResolvedValue({ annotation_id: "ann_1" }) } as const;
    const parsed = JSON.parse(await handleAnnotateSpan(client as never, { span_id: "s1", content: "finding" }));
    expect(parsed.primary.annotation_id).toBe("ann_1");
    expect(parsed.source).toBe("annotations");
  });

  it("rethrows ApiError on 404", async () => {
    const { ApiError } = await import("../api-client.js");
    const client = {
      annotateSpan: vi.fn().mockRejectedValue(new ApiError("span not found", 404)),
    } as const;
    await expect(handleAnnotateSpan(client as never, { span_id: "s_ghost", content: "x" })).rejects.toThrow(/not found/);
  });
});
