import type {
  EventCountResult,
  RetentionResult,
  UserJourneyResult,
  TopEventsResult,
  Filter,
} from "@inferevents/shared";
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

  async getEventCounts(params: {
    eventName: string;
    timeRange: string;
    groupBy?: string;
    filters?: Filter[];
    projectId?: string;
  }): Promise<EventCountResult> {
    const query = new URLSearchParams();
    query.set("event_name", params.eventName);
    query.set("time_range", params.timeRange);

    if (params.groupBy) {
      query.set("group_by", params.groupBy);
    }

    if (params.filters && params.filters.length > 0) {
      query.set("filters", JSON.stringify(params.filters));
    }

    const projectId = params.projectId ?? this.defaultProjectId;
    if (projectId) {
      query.set("project_id", projectId);
    }

    return this.get<EventCountResult>(
      `/v1/query/event-counts?${query.toString()}`
    );
  }

  async getRetention(params: {
    startEvent: string;
    returnEvent: string;
    timeRange: string;
    granularity: string;
    projectId?: string;
  }): Promise<RetentionResult> {
    const query = new URLSearchParams();
    query.set("start_event", params.startEvent);
    query.set("return_event", params.returnEvent);
    query.set("time_range", params.timeRange);
    query.set("granularity", params.granularity);

    const projectId = params.projectId ?? this.defaultProjectId;
    if (projectId) {
      query.set("project_id", projectId);
    }

    return this.get<RetentionResult>(
      `/v1/query/retention?${query.toString()}`
    );
  }

  async getUserJourney(params: {
    userId: string;
    timeRange?: string;
    limit?: number;
    projectId?: string;
  }): Promise<UserJourneyResult> {
    const query = new URLSearchParams();
    query.set("user_id", params.userId);

    if (params.timeRange) {
      query.set("time_range", params.timeRange);
    }

    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }

    const projectId = params.projectId ?? this.defaultProjectId;
    if (projectId) {
      query.set("project_id", projectId);
    }

    return this.get<UserJourneyResult>(
      `/v1/query/user-journey?${query.toString()}`
    );
  }

  async getTopEvents(params: {
    timeRange: string;
    limit?: number;
    projectId?: string;
  }): Promise<TopEventsResult> {
    const query = new URLSearchParams();
    query.set("time_range", params.timeRange);

    if (params.limit !== undefined) {
      query.set("limit", String(params.limit));
    }

    const projectId = params.projectId ?? this.defaultProjectId;
    if (projectId) {
      query.set("project_id", projectId);
    }

    return this.get<TopEventsResult>(
      `/v1/query/top-events?${query.toString()}`
    );
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

  async getOntology(params?: {
    status?: string;
  }): Promise<{ entries: Array<{ project_id: string; event_name: string; category: string; funnel_stage: number | null; description: string | null; success_indicator: boolean; source: string; status: string; created_at: string; updated_at: string }>; total: number }> {
    const query = new URLSearchParams();
    if (params?.status) {
      query.set("status", params.status);
    }
    const qs = query.toString();
    return this.get(`/v1/query/ontology${qs ? `?${qs}` : ""}`);
  }

  async updateOntology(entries: Array<{
    event_name: string;
    category: string;
    funnel_stage?: number;
    description?: string;
    success_indicator?: boolean;
    status?: string;
  }>): Promise<{ updated: number; total: number }> {
    return this.post("/v1/query/ontology", { entries });
  }

  async getProjectSummary(): Promise<{
    sections: Record<string, unknown>;
    compiled_at: string | null;
    message?: string;
  }> {
    return this.get(`/v1/query/project-summary`);
  }

  async annotateThread(params: {
    threadId: string;
    content: string;
    source?: "agent" | "human";
  }): Promise<{ thread_id: string; annotation_count: number }> {
    return this.post("/v1/query/annotate", {
      thread_id: params.threadId,
      content: params.content,
      source: params.source ?? "agent",
    });
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
