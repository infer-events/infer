import { describe, it, expect } from "vitest";
import { extractAuthConfig } from "./remote.js";

describe("extractAuthConfig", () => {
  it("extracts pk_read_ key from Authorization header", () => {
    const headers = new Headers({
      Authorization: "Bearer pk_read_abc123",
    });
    const config = extractAuthConfig(headers);
    expect(config).toEqual({
      apiKey: "pk_read_abc123",
      endpoint: "https://api.infer.events",
    });
  });

  it("returns null for missing Authorization header", () => {
    const headers = new Headers();
    const config = extractAuthConfig(headers);
    expect(config).toBeNull();
  });

  it("returns null for non-Bearer auth", () => {
    const headers = new Headers({
      Authorization: "Basic abc123",
    });
    const config = extractAuthConfig(headers);
    expect(config).toBeNull();
  });

  it("returns null for write keys (pk_write_)", () => {
    const headers = new Headers({
      Authorization: "Bearer pk_write_abc123",
    });
    const config = extractAuthConfig(headers);
    expect(config).toBeNull();
  });

  it("returns null for empty Bearer token", () => {
    const headers = new Headers({
      Authorization: "Bearer ",
    });
    const config = extractAuthConfig(headers);
    expect(config).toBeNull();
  });
});
