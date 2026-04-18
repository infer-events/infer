import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "./api-client.js";
import type { InferConfig } from "./config.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeConfig(overrides?: Partial<InferConfig>): InferConfig {
  return {
    apiKey: "pk_read_test123",
    endpoint: "https://api.infer.events",
    projectId: "proj_default",
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function textResponse(body: string, status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(body),
  } as Response;
}

describe("ApiClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("sets base URL from config", async () => {
      const client = new ApiClient(makeConfig({ endpoint: "https://custom.api.com" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object),
      );
    });

    it("sets auth headers from config apiKey", async () => {
      const client = new ApiClient(makeConfig({ apiKey: "pk_read_mykey" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer pk_read_mykey",
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  describe("listSpans", () => {
    it("hits /v1/query/spans and never sends project_id", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ spans: [], next_cursor: null }));

      await client.listSpans({});

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/spans");
      expect(url.searchParams.has("project_id")).toBe(false);
    });

    it("forwards every filter as its query-string equivalent", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ spans: [], next_cursor: null }));

      await client.listSpans({
        model: "gpt-4o-mini",
        user_id: "u_1",
        session_id: "s_1",
        time_window: "24h",
        tags: ["prod", "agent"],
        min_duration_ms: 500,
        status_min: 400,
        status_max: 599,
        cursor: "cur_abc",
        limit: 25,
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("model")).toBe("gpt-4o-mini");
      expect(url.searchParams.get("user_id")).toBe("u_1");
      expect(url.searchParams.get("session_id")).toBe("s_1");
      expect(url.searchParams.get("time_window")).toBe("24h");
      expect(url.searchParams.get("tags")).toBe("prod,agent");
      expect(url.searchParams.get("min_duration_ms")).toBe("500");
      expect(url.searchParams.get("status_min")).toBe("400");
      expect(url.searchParams.get("status_max")).toBe("599");
      expect(url.searchParams.get("cursor")).toBe("cur_abc");
      expect(url.searchParams.get("limit")).toBe("25");
    });
  });

  describe("getTrace / getSpan — URL-encoded params", () => {
    it("encodes trace_id into the path", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ trace_id: "t1", root_span_id: "s1", spans: [], span_count: 0, total_duration_ms: 0 }));

      await client.getTrace("t1/with slash");

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/trace/t1%2Fwith%20slash");
    });

    it("encodes span_id into the path", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ span: {}, annotations: [] }));

      await client.getSpan("span abc");

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/span/span%20abc");
    });
  });

  describe("stats endpoints — dimension + time_window forwarding", () => {
    it("getLatencyStats", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ dimension: "model", time_window: "24h", groups: [] }));
      await client.getLatencyStats({ dimension: "model", time_window: "24h" });
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/latency-stats");
      expect(url.searchParams.get("dimension")).toBe("model");
      expect(url.searchParams.get("time_window")).toBe("24h");
    });

    it("getTokenUsage", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ dimension: "user", time_window: "7d", groups: [] }));
      await client.getTokenUsage({ dimension: "user", time_window: "7d" });
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/token-usage");
      expect(url.searchParams.get("dimension")).toBe("user");
    });

    it("getCostStats", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ dimension: "model", time_window: "24h", rows: [], pricing_source_version: "2026-04-01" }));
      await client.getCostStats({ dimension: "model", time_window: "24h" });
      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/cost-stats");
    });

    it("getErrorSpans optional params", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ time_window: "24h", spans: [], error_type_counts: {}, next_cursor: null }));
      await client.getErrorSpans({});
      let url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/error-spans");
      expect([...url.searchParams.keys()].length).toBe(0);

      mockFetch.mockResolvedValueOnce(jsonResponse({ time_window: "7d", spans: [], error_type_counts: {}, next_cursor: null }));
      await client.getErrorSpans({ time_window: "7d", limit: 100, cursor: "c1" });
      url = new URL(mockFetch.mock.calls[1][0] as string);
      expect(url.searchParams.get("time_window")).toBe("7d");
      expect(url.searchParams.get("limit")).toBe("100");
      expect(url.searchParams.get("cursor")).toBe("c1");
    });
  });

  describe("annotate endpoints — POST body", () => {
    it("annotateSpan POSTs JSON body to /v1/query/annotate-span", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ annotation_id: "ann_1" }));

      await client.annotateSpan({ span_id: "s1", content: "finding" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      const init = mockFetch.mock.calls[0][1] as RequestInit;
      expect(url.pathname).toBe("/v1/query/annotate-span");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ span_id: "s1", content: "finding" }));
    });

    it("annotateTrace POSTs to /v1/query/annotate-trace", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ annotation_id: "ann_t" }));

      await client.annotateTrace({ trace_id: "t1", content: "diagnosis" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      const init = mockFetch.mock.calls[0][1] as RequestInit;
      expect(url.pathname).toBe("/v1/query/annotate-trace");
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ trace_id: "t1", content: "diagnosis" }));
    });
  });

  describe("getInsights", () => {
    it("calls correct URL", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights();

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/insights");
    });

    it("includes optional severity filter", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights({ severity: "critical" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("severity")).toBe("critical");
    });

    it("works without params", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights();

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.has("severity")).toBe(false);
    });
  });

  describe("§7.4 tenant-isolation: NO method sends project_id on the wire", () => {
    it.each([
      async (c: ApiClient) => c.listSpans({}),
      async (c: ApiClient) => c.getTrace("t1"),
      async (c: ApiClient) => c.getSpan("s1"),
      async (c: ApiClient) => c.getLatencyStats({ dimension: "model", time_window: "24h" }),
      async (c: ApiClient) => c.getTokenUsage({ dimension: "model", time_window: "7d" }),
      async (c: ApiClient) => c.getCostStats({ dimension: "model", time_window: "7d" }),
      async (c: ApiClient) => c.getErrorSpans({}),
      async (c: ApiClient) => c.annotateSpan({ span_id: "s1", content: "x" }),
      async (c: ApiClient) => c.annotateTrace({ trace_id: "t1", content: "x" }),
      async (c: ApiClient) => c.getInsights(),
      async (c: ApiClient) => c.getProjectSummary(),
    ])("method %# does not include project_id in URL or body", async (callMethod) => {
      const client = new ApiClient(makeConfig({ projectId: "proj_default" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await callMethod(client);

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
      const u = new URL(url);
      expect(u.searchParams.has("project_id")).toBe(false);
      expect(u.pathname.includes("project_id")).toBe(false);
      if (init?.body !== undefined && typeof init.body === "string") {
        expect(init.body).not.toContain("project_id");
      }
    });
  });

  describe("error handling", () => {
    it("throws ApiError with status 401 and auth failed message", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(textResponse("Unauthorized", 401));

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toMatch(/Authentication failed/);
      }
    });

    it("includes statusCode 401 on ApiError", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(textResponse("Unauthorized", 401));

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
      }
    });

    it("throws ApiError with status 403 and access denied message", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(textResponse("Forbidden", 403));

      await expect(client.getInsights()).rejects.toThrow(ApiError);

      mockFetch.mockResolvedValueOnce(textResponse("Forbidden", 403));

      await expect(client.getInsights()).rejects.toThrow(/Access denied/);
    });

    it("throws ApiError with status 500 and includes body detail", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(
        textResponse('{"error": "Internal server error"}', 500),
      );

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(500);
        expect((err as ApiError).message).toContain("Internal server error");
      }
    });

    it("throws ApiError on network failure with connection error", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(0);
        expect((err as ApiError).message).toContain("Failed to connect");
        expect((err as ApiError).message).toContain("ECONNREFUSED");
      }
    });

    it("parses JSON error body when available", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: () => Promise.resolve('{"error": "Invalid time range"}'),
      } as Response);

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toContain("Invalid time range");
      }
    });

    it("uses message field from JSON error body", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message": "Bad request format"}'),
      } as Response);

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toContain("Bad request format");
      }
    });

    it("falls back to raw text when body is not JSON", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve("Bad Gateway"),
      } as Response);

      try {
        await client.getInsights();
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).message).toContain("Bad Gateway");
        expect((err as ApiError).statusCode).toBe(502);
      }
    });
  });

  describe("ApiError", () => {
    it('has name "ApiError"', () => {
      const err = new ApiError("test", 500);
      expect(err.name).toBe("ApiError");
    });

    it("extends Error", () => {
      const err = new ApiError("test", 500);
      expect(err).toBeInstanceOf(Error);
    });

    it("stores statusCode", () => {
      const err = new ApiError("test", 404);
      expect(err.statusCode).toBe(404);
    });

    it("stores message", () => {
      const err = new ApiError("something went wrong", 500);
      expect(err.message).toBe("something went wrong");
    });
  });
});
