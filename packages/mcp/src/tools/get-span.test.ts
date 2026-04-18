import { describe, it, expect, vi } from "vitest";
import { handleGetSpan } from "./get-span.js";
import singleSpan from "../../test/fixtures/spans/single-span.json" with { type: "json" };
import errorSpan from "../../test/fixtures/spans/error-span.json" with { type: "json" };
import truncatedSpan from "../../test/fixtures/spans/truncated-span.json" with { type: "json" };
import estimatedSpan from "../../test/fixtures/spans/estimated-tokens-span.json" with { type: "json" };

const fakeClient = (response: unknown) =>
  ({ getSpan: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetSpan", () => {
  it("renders a happy-path span with empty warnings/caveats", async () => {
    const client = fakeClient({ span: singleSpan, annotations: [] });
    const parsed = JSON.parse(await handleGetSpan(client as never, { span_id: singleSpan.span_id }));
    expect(parsed.primary.span.span_id).toBe(singleSpan.span_id);
    expect(parsed.primary.annotations).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it("surfaces a warning on error spans (status_code >= 400)", async () => {
    const client = fakeClient({ span: errorSpan, annotations: [] });
    const parsed = JSON.parse(await handleGetSpan(client as never, { span_id: errorSpan.span_id }));
    expect(parsed.warnings.some((w: string) => w.includes("500"))).toBe(true);
  });

  it("surfaces a warning on stream_truncated spans", async () => {
    const client = fakeClient({ span: truncatedSpan, annotations: [] });
    const parsed = JSON.parse(await handleGetSpan(client as never, { span_id: truncatedSpan.span_id }));
    expect(parsed.warnings.some((w: string) => w.includes("truncated"))).toBe(true);
  });

  it("surfaces a warning on estimated-token spans", async () => {
    const client = fakeClient({ span: estimatedSpan, annotations: [] });
    const parsed = JSON.parse(await handleGetSpan(client as never, { span_id: estimatedSpan.span_id }));
    expect(parsed.warnings.some((w: string) => w.includes("estimated"))).toBe(true);
  });

  it("surfaces a caveat when body_stored=false (redacted span)", async () => {
    const redacted = { ...singleSpan, body_stored: false, messages: null };
    const client = fakeClient({ span: redacted, annotations: [] });
    const parsed = JSON.parse(await handleGetSpan(client as never, { span_id: singleSpan.span_id }));
    expect(parsed.caveats.some((c: string) => c.includes("redacted"))).toBe(true);
  });
});
