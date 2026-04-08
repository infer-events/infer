export interface AnalyticsEvent {
  event_id: string;
  project_id: string;
  user_id?: string;
  anonymous_id: string;
  event_name: string;
  event_type: "track" | "identify" | "page" | "screen";
  properties: Record<string, string | number | boolean | null>;
  context: EventContext;
  timestamp: string;
  received_at?: string;
}

export interface EventContext {
  platform: "web" | "react-native";
  os?: string;
  browser?: string;
  screen_width?: number;
  screen_height?: number;
  locale?: string;
  timezone?: string;
  app_version?: string;
  sdk_version: string;
  page_url?: string;
  page_title?: string;
  screen_name?: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export type TimeRangeInput = TimeRange | "last_24h" | "last_7d" | "last_30d" | "last_90d";

export interface EventCountResult {
  groups: Array<{ key: string; count: number }>;
  total: number;
  warning?: string;
}

export interface RetentionCohort {
  period: string;
  users_start: number;
  retained: number[];
}

export interface RetentionResult {
  cohorts: RetentionCohort[];
  warning?: string;
}

export interface UserJourneyEvent {
  event_name: string;
  properties: Record<string, string | number | boolean | null>;
  timestamp: string;
}

export interface UserJourneyResult {
  events: UserJourneyEvent[];
  warning?: string;
}

export interface TopEvent {
  event_name: string;
  count: number;
  unique_users: number;
}

export interface TopEventsResult {
  events: TopEvent[];
  total_event_names: number;
  warning?: string;
}

export interface Filter {
  field: string;
  op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains";
  value: string | number | boolean;
}

export type ApiKeyType = "write" | "read";

export type EventCategory = "activation" | "engagement" | "monetization" | "referral" | "noise";

export type OntologyStatus = "proposed" | "confirmed" | "rejected";

export type OntologySource = "sdk" | "agent";

export interface EventOntologyEntry {
  project_id: string;
  event_name: string;
  category: EventCategory;
  funnel_stage?: number;
  description?: string;
  success_indicator: boolean;
  source: OntologySource;
  status: OntologyStatus;
  created_at: string;
  updated_at: string;
}

export interface EventOntologyResult {
  entries: EventOntologyEntry[];
  total: number;
}

export type InsightActionType = "code" | "strategy";

export type InsightConfidence = "low" | "medium" | "high";

export interface Insight {
  id: string;
  type: string;
  name: string;
  summary: string;
  evidence: Record<string, unknown>;
  severity: "critical" | "notable" | "informational";
  detected_at: string;
  action_type: InsightActionType | null;
  suggested_action: string | null;
  correlation_hint: string | null;
  related_events: string[];
  confidence: InsightConfidence;
}

export interface InsightsResult {
  insights: Insight[];
  count: number;
}

// --- Feature A: Insight Threads ---

export interface ThreadAnnotation {
  content: string;
  source: "agent" | "human";
  created_at: string;
}

export interface InsightThread {
  id: string;
  project_id: string;
  title: string;
  base_insight_name: string;
  status: "active" | "stale" | "resolved";
  first_detected_at: string;
  last_detected_at: string;
  insight_count: number;
  related_events: string[];
  annotations: ThreadAnnotation[];
}

export interface InsightThreadContext {
  thread_id: string;
  title: string;
  day_count: number;
  first_detected_at: string;
  status: "active" | "stale" | "resolved";
  latest_annotation: string | null;
}

export interface InsightWithThread extends Insight {
  thread: InsightThreadContext | null;
}

export interface InsightsWithThreadsResult {
  insights: InsightWithThread[];
  count: number;
}

// --- Feature D: Project Analytics Wiki ---

export interface ProjectSummaryKeyMetrics {
  total_events_30d: number;
  unique_users_30d: number;
  daily_active_avg: number;
  error_rate_pct: number;
  events_trend_pct: number;
  users_trend_pct: number;
  health_score: number;
  active_issues: number;
}

export interface ProjectSummaryEventEntry {
  event_name: string;
  category: string | null;
  count_30d: number;
  unique_users_30d: number;
  trend: "up" | "down" | "stable";
}

export interface ProjectSummaryFunnelStep {
  from_event: string;
  to_event: string;
  conversion_pct: number;
  trend: "up" | "down" | "stable";
}

export interface ProjectSummaryActiveThread {
  id: string;
  title: string;
  severity: string;
  day_count: number;
  insight_count: number;
  latest_annotation: string | null;
}

export interface ProjectSummary {
  sections: {
    key_metrics: ProjectSummaryKeyMetrics;
    event_catalog: ProjectSummaryEventEntry[];
    funnel_health: ProjectSummaryFunnelStep[];
    active_threads: ProjectSummaryActiveThread[];
  };
  compiled_at: string;
}
