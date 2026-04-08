# @inferevents/mcp

MCP server for [Infer](https://infer.events) — analytics designed for AI agents, not dashboards.

Connects to Claude Code (or any MCP client) and exposes 5 analytics tools. Includes auto-detected insights pushed hourly.

## Install

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "infer": {
      "command": "npx",
      "args": ["@inferevents/mcp"]
    }
  }
}
```

The server reads credentials from `~/.infer/config.json`:

```json
{
  "apiKey": "pk_read_...",
  "endpoint": "https://api.infer.events",
  "projectId": "proj_..."
}
```

## Tools

### `get_insights`

Returns auto-detected anomalies and notable patterns. Computed hourly by the Infer backend. Always call this first.

```
"Any insights?"  →  get_insights()
"What's wrong?"  →  get_insights(severity: "critical")
```

Returns pre-computed findings: volume drops, error spikes, new events, milestones, cohort trends.

### `get_event_counts`

Count events over a time range, optionally grouped by a property.

```
"How many signups this week?"         →  get_event_counts(event_name: "signup", time_range: "last_7d")
"Signups by country"                  →  get_event_counts(event_name: "signup", time_range: "last_7d", group_by: "country")
"Compare this week vs last"           →  two calls with different time_range values
```

Supports grouping by event properties, context fields (browser, os, country, city), and top-level columns (anonymous_id, user_id).

### `get_retention`

Cohort-based retention analysis.

```
"What's our retention?"               →  get_retention(start_event: "signup", return_event: "page_view", time_range: "last_30d", granularity: "week")
"Do users come back after onboarding?" →  get_retention(start_event: "onboarding_done", return_event: "login", ...)
```

Returns retention percentages per cohort with visual bar charts and benchmark indicators.

### `get_user_journey`

Ordered event sequence for a specific user.

```
"What did this user do?"              →  get_user_journey(user_id: "user_123")
"Trace a churned user"                →  get_user_journey(user_id: "<id from get_event_counts group_by anonymous_id>")
```

Groups events into sessions (30-min gap), shows timestamps and properties.

### `get_top_events`

Most frequent events with counts and unique users.

```
"What events are being tracked?"      →  get_top_events(time_range: "last_30d")
"Top events this week"                →  get_top_events(time_range: "last_7d", limit: 10)
```

Includes available fields for `group_by` so the agent knows what it can query.

## Output format

All tools return pre-formatted text with Unicode bar charts inside code blocks:

```
Top Events — last_7d
84 total events across 8 types
──────────────────────────────────────────────────

click                   ████████████████████  26 (31%)

demo_tab_clicked        ███████████████████░  25 (30%)

page_view               ████████████░░░░░░░░  16 (19%)
```

## Skills

Install the agent skills for guided analytics workflows:

```bash
npx skills add infer-events/skills
```

Skills teach the agent how to interpret data, run health checks, build tracking plans, and keep everything updated.

## License

MIT
