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
    it("sets base URL from config", () => {
      const client = new ApiClient(makeConfig({ endpoint: "https://custom.api.com" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      client.getEventCounts({ eventName: "test", timeRange: "7d" });

      // We'll verify the URL in the fetch call
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom.api.com"),
        expect.any(Object),
      );
    });

    it("sets auth headers from config apiKey", async () => {
      const client = new ApiClient(makeConfig({ apiKey: "pk_read_mykey" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({ eventName: "test", timeRange: "7d" });

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

  describe("getEventCounts", () => {
    it("calls correct URL with query params", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({ eventName: "signup", timeRange: "7d" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/event-counts");
    });

    it("includes event_name and time_range", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({ eventName: "signup", timeRange: "30d" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("event_name")).toBe("signup");
      expect(url.searchParams.get("time_range")).toBe("30d");
    });

    it("includes optional group_by", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({
        eventName: "signup",
        timeRange: "7d",
        groupBy: "country",
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("group_by")).toBe("country");
    });

    it("includes optional filters as JSON", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      const filters = [{ field: "plan", op: "eq" as const, value: "pro" }];
      await client.getEventCounts({
        eventName: "signup",
        timeRange: "7d",
        filters,
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("filters")).toBe(JSON.stringify(filters));
    });

    it("does not include filters when array is empty", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({
        eventName: "signup",
        timeRange: "7d",
        filters: [],
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.has("filters")).toBe(false);
    });

    it("includes project_id from params when provided", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({
        eventName: "signup",
        timeRange: "7d",
        projectId: "proj_override",
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("project_id")).toBe("proj_override");
    });

    it("falls back to default project_id from config", async () => {
      const client = new ApiClient(makeConfig({ projectId: "proj_default" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ groups: [], total: 0 }));

      await client.getEventCounts({ eventName: "signup", timeRange: "7d" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("project_id")).toBe("proj_default");
    });
  });

  describe("getRetention", () => {
    it("calls correct URL with all required params", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ cohorts: [] }));

      await client.getRetention({
        startEvent: "signup",
        returnEvent: "login",
        timeRange: "30d",
        granularity: "week",
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/retention");
      expect(url.searchParams.get("start_event")).toBe("signup");
      expect(url.searchParams.get("return_event")).toBe("login");
      expect(url.searchParams.get("time_range")).toBe("30d");
      expect(url.searchParams.get("granularity")).toBe("week");
    });

    it("includes project_id", async () => {
      const client = new ApiClient(makeConfig({ projectId: "proj_ret" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ cohorts: [] }));

      await client.getRetention({
        startEvent: "signup",
        returnEvent: "login",
        timeRange: "30d",
        granularity: "week",
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("project_id")).toBe("proj_ret");
    });

    it("uses param projectId over default", async () => {
      const client = new ApiClient(makeConfig({ projectId: "proj_default" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ cohorts: [] }));

      await client.getRetention({
        startEvent: "signup",
        returnEvent: "login",
        timeRange: "30d",
        granularity: "week",
        projectId: "proj_override",
      });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("project_id")).toBe("proj_override");
    });
  });

  describe("getUserJourney", () => {
    it("calls correct URL with user_id", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [] }));

      await client.getUserJourney({ userId: "user_abc" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/user-journey");
      expect(url.searchParams.get("user_id")).toBe("user_abc");
    });

    it("includes optional time_range", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [] }));

      await client.getUserJourney({ userId: "user_abc", timeRange: "7d" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("time_range")).toBe("7d");
    });

    it("includes optional limit", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [] }));

      await client.getUserJourney({ userId: "user_abc", limit: 50 });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("limit")).toBe("50");
    });

    it("does not include time_range or limit when not provided", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [] }));

      await client.getUserJourney({ userId: "user_abc" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.has("time_range")).toBe(false);
      expect(url.searchParams.has("limit")).toBe(false);
    });
  });

  describe("getTopEvents", () => {
    it("calls correct URL with time_range", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [], total_event_names: 0 }));

      await client.getTopEvents({ timeRange: "24h" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.pathname).toBe("/v1/query/top-events");
      expect(url.searchParams.get("time_range")).toBe("24h");
    });

    it("includes optional limit", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [], total_event_names: 0 }));

      await client.getTopEvents({ timeRange: "7d", limit: 10 });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("limit")).toBe("10");
    });

    it("includes project_id from config default", async () => {
      const client = new ApiClient(makeConfig({ projectId: "proj_top" }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ events: [], total_event_names: 0 }));

      await client.getTopEvents({ timeRange: "7d" });

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.get("project_id")).toBe("proj_top");
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
      // No query string when no params
      expect(url.searchParams.has("severity")).toBe(false);
    });

    it("works with empty params object", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(jsonResponse({ insights: [], count: 0 }));

      await client.getInsights({});

      const url = new URL(mockFetch.mock.calls[0][0] as string);
      expect(url.searchParams.has("severity")).toBe(false);
    });
  });

  describe("error handling", () => {
    it("throws ApiError with status 401 and auth failed message", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(textResponse("Unauthorized", 401));

      try {
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
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
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
      }
    });

    it("throws ApiError with status 403 and access denied message", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(textResponse("Forbidden", 403));

      await expect(
        client.getEventCounts({ eventName: "test", timeRange: "7d" }),
      ).rejects.toThrow(ApiError);

      mockFetch.mockResolvedValueOnce(textResponse("Forbidden", 403));

      await expect(
        client.getEventCounts({ eventName: "test", timeRange: "7d" }),
      ).rejects.toThrow(/Access denied/);
    });

    it("throws ApiError with status 500 and includes body detail", async () => {
      const client = new ApiClient(makeConfig());
      mockFetch.mockResolvedValueOnce(
        textResponse('{"error": "Internal server error"}', 500),
      );

      try {
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
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
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
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
        await client.getEventCounts({ eventName: "test", timeRange: "invalid" });
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
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
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
        await client.getEventCounts({ eventName: "test", timeRange: "7d" });
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
