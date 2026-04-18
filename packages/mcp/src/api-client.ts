import type { InferConfig } from "./config.js";

export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly defaultProjectId: string | undefined;

  constructor(config: InferConfig) {
    this.baseUrl = config.endpoint;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
    this.defaultProjectId = config.projectId;
  }

  async getInsights(params?: {
    severity?: string;
  }): Promise<{ insights: Array<{ id: string; type: string; name: string; summary: string; evidence: Record<string, unknown>; severity: string; detected_at: string; action_type: string | null; suggested_action: string | null; correlation_hint: string | null; related_events: string[]; confidence: string; thread: { thread_id: string; title: string; day_count: number; first_detected_at: string; status: string; latest_annotation: string | null } | null }>; count: number }> {
    const query = new URLSearchParams();
    if (params?.severity) {
      query.set("severity", params.severity);
    }
    const qs = query.toString();
    return this.get(`/v1/query/insights${qs ? `?${qs}` : ""}`);
  }

  async getProjectSummary(): Promise<{
    sections: Record<string, unknown>;
    compiled_at: string | null;
    message?: string;
  }> {
    return this.get(`/v1/query/project-summary`);
  }

  async annotateSpan(params: { span_id: string; content: string }): Promise<{ annotation_id: string }> {
    return this.post("/v1/query/annotate-span", params);
  }

  async annotateTrace(params: { trace_id: string; content: string }): Promise<{ annotation_id: string }> {
    return this.post("/v1/query/annotate-trace", params);
  }

  async listSpans(params: {
    model?: string;
    user_id?: string;
    session_id?: string;
    time_window?: "1h" | "6h" | "24h" | "7d" | "30d";
    tags?: string[];
    min_duration_ms?: number;
    status_min?: number;
    status_max?: number;
    cursor?: string;
    limit?: number;
  }): Promise<{
    spans: Array<{
      span_id: string;
      trace_id: string;
      start_time: string;
      end_time: string;
      duration_ms: number;
      gen_ai_system: string;
      gen_ai_request_model: string | null;
      gen_ai_usage_input_tokens: number | null;
      gen_ai_usage_output_tokens: number | null;
      status_code: number;
      error_type: string | null;
      stream: boolean;
      user_id: string | null;
      session_id: string | null;
      tags: string[] | null;
      stream_truncated: boolean;
    }>;
    next_cursor: string | null;
  }> {
    const query = new URLSearchParams();
    if (params.model !== undefined) query.set("model", params.model);
    if (params.user_id !== undefined) query.set("user_id", params.user_id);
    if (params.session_id !== undefined) query.set("session_id", params.session_id);
    if (params.time_window !== undefined) query.set("time_window", params.time_window);
    if (params.tags !== undefined && params.tags.length > 0) query.set("tags", params.tags.join(","));
    if (params.min_duration_ms !== undefined) query.set("min_duration_ms", String(params.min_duration_ms));
    if (params.status_min !== undefined) query.set("status_min", String(params.status_min));
    if (params.status_max !== undefined) query.set("status_max", String(params.status_max));
    if (params.cursor !== undefined) query.set("cursor", params.cursor);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.get(`/v1/query/spans${qs ? `?${qs}` : ""}`);
  }

  async getSpan(spanId: string): Promise<{
    span: Record<string, unknown>;
    annotations: Array<{ id: string; content: string; author: string | null; created_at: string }>;
  }> {
    return this.get(`/v1/query/span/${encodeURIComponent(spanId)}`);
  }

  async getTrace(traceId: string): Promise<{
    trace_id: string;
    root_span_id: string;
    spans: Array<{
      span_id: string;
      parent_span_id: string | null;
      depth: number;
      start_time: string;
      end_time: string;
      duration_ms: number;
      gen_ai_system: string;
      gen_ai_request_model: string | null;
      gen_ai_usage_input_tokens: number | null;
      gen_ai_usage_output_tokens: number | null;
      status_code: number;
      error_type: string | null;
      finish_reasons: string[] | null;
      stream: boolean;
      stream_truncated: boolean;
    }>;
    span_count: number;
    total_duration_ms: number;
  }> {
    return this.get(`/v1/query/trace/${encodeURIComponent(traceId)}`);
  }

  async getLatencyStats(params: {
    dimension: "model" | "user" | "session" | "feature";
    time_window: "1h" | "6h" | "24h" | "7d" | "30d";
  }): Promise<{
    dimension: string;
    time_window: string;
    groups: Array<{ key: string | null; count: number; p50_ms: number; p95_ms: number; p99_ms: number; mean_ms: number }>;
  }> {
    const query = new URLSearchParams({
      dimension: params.dimension,
      time_window: params.time_window,
    });
    return this.get(`/v1/query/latency-stats?${query.toString()}`);
  }

  async getTokenUsage(params: {
    dimension: "model" | "user" | "session" | "feature";
    time_window: "1h" | "6h" | "24h" | "7d" | "30d";
  }): Promise<{
    dimension: string;
    time_window: string;
    groups: Array<{ key: string | null; count: number; input_tokens: number; output_tokens: number; estimated_fraction: number }>;
  }> {
    const query = new URLSearchParams({ dimension: params.dimension, time_window: params.time_window });
    return this.get(`/v1/query/token-usage?${query.toString()}`);
  }

  async getCostStats(params: {
    dimension: "model" | "user" | "session" | "feature";
    time_window: "1h" | "6h" | "24h" | "7d" | "30d";
  }): Promise<{
    dimension: string;
    time_window: string;
    rows: Array<{ dimension_key: string | null; provider: string; model: string; count: number; input_tokens: number; output_tokens: number }>;
    pricing_source_version: string;
  }> {
    const query = new URLSearchParams({ dimension: params.dimension, time_window: params.time_window });
    return this.get(`/v1/query/cost-stats?${query.toString()}`);
  }

  async getErrorSpans(params: {
    time_window?: "1h" | "6h" | "24h" | "7d" | "30d";
    limit?: number;
    cursor?: string;
  }): Promise<{
    time_window: string;
    spans: Array<{
      span_id: string; trace_id: string; start_time: string; end_time: string;
      duration_ms: number; gen_ai_system: string; gen_ai_request_model: string | null;
      status_code: number; error_type: string | null; upstream_host: string;
      attempt_count: number; stream_truncated: boolean;
    }>;
    error_type_counts: Record<string, number>;
    next_cursor: string | null;
  }> {
    const query = new URLSearchParams();
    if (params.time_window !== undefined) query.set("time_window", params.time_window);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.cursor !== undefined) query.set("cursor", params.cursor);
    const qs = query.toString();
    return this.get(`/v1/query/error-spans${qs ? `?${qs}` : ""}`);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new ApiError(
        `Failed to connect to Infer API at ${this.baseUrl}: ${message}.`,
        0
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let detail = text;
      try {
        const parsed = JSON.parse(text) as { error?: string };
        detail = parsed.error ?? text;
      } catch { /* not JSON */ }
      throw new ApiError(
        `Infer API returned ${response.status}: ${detail}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: this.headers,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new ApiError(
        `Failed to connect to Infer API at ${this.baseUrl}: ${message}. ` +
          `Check that the endpoint in ~/.infer/config.json is correct.`,
        0
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let detail = body;
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string };
        detail = parsed.error ?? parsed.message ?? body;
      } catch {
        // body wasn't JSON, use raw text
      }

      if (response.status === 401) {
        throw new ApiError(
          `Authentication failed. Check that your API key in ~/.infer/config.json is valid.`,
          401
        );
      }

      if (response.status === 403) {
        throw new ApiError(
          `Access denied. Your API key may not have read permissions for this project.`,
          403
        );
      }

      throw new ApiError(
        `Infer API returned ${response.status}: ${detail}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
