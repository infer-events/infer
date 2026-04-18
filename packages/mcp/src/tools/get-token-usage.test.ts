import { describe, it, expect, vi } from "vitest";
import { handleGetTokenUsage } from "./get-token-usage.js";

const fakeClient = (response: unknown) =>
  ({ getTokenUsage: vi.fn().mockResolvedValue(response) }) as const;

describe("handleGetTokenUsage", () => {
  it("passes through groups", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      groups: [{ key: "gpt-4o-mini", count: 100, input_tokens: 5000, output_tokens: 1800, estimated_fraction: 0 }],
    });
    const parsed = JSON.parse(await handleGetTokenUsage(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.primary.groups[0].input_tokens).toBe(5000);
  });

  it("warns when estimated_fraction > 0", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      groups: [
        { key: "glm-5.1:cloud", count: 50,  input_tokens: 10000, output_tokens: 4000, estimated_fraction: 1.0 },
        { key: "gpt-4o-mini",   count: 100, input_tokens: 5000,  output_tokens: 1800, estimated_fraction: 0.1 },
      ],
    });
    const parsed = JSON.parse(await handleGetTokenUsage(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.warnings.some((w: string) => w.includes("glm-5.1:cloud") && w.includes("100%"))).toBe(true);
    expect(parsed.warnings.some((w: string) => w.includes("gpt-4o-mini") && w.includes("10%"))).toBe(true);
  });

  it("does NOT warn when estimated_fraction == 0 for all groups", async () => {
    const client = fakeClient({
      dimension: "model",
      time_window: "7d",
      groups: [{ key: "gpt-4o-mini", count: 100, input_tokens: 5000, output_tokens: 1800, estimated_fraction: 0 }],
    });
    const parsed = JSON.parse(await handleGetTokenUsage(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.warnings.every((w: string) => !w.includes("estimated"))).toBe(true);
  });

  it("warns when zero groups returned", async () => {
    const client = fakeClient({ dimension: "model", time_window: "7d", groups: [] });
    const parsed = JSON.parse(await handleGetTokenUsage(client as never, { dimension: "model", time_window: "7d" }));
    expect(parsed.warnings.some((w: string) => /no token data/i.test(w))).toBe(true);
  });
});
