import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Skills are separate (@inferevents/skills). MCP server = tools only.
import { ApiClient, ApiError } from "./api-client.js";
import { loadConfig, type InferConfig } from "./config.js";
import {
  getEventCountsSchema,
  handleGetEventCounts,
} from "./tools/get-event-counts.js";
import {
  getRetentionSchema,
  handleGetRetention,
} from "./tools/get-retention.js";
import {
  getUserJourneySchema,
  handleGetUserJourney,
} from "./tools/get-user-journey.js";
import {
  getTopEventsSchema,
  handleGetTopEvents,
} from "./tools/get-top-events.js";
import {
  getInsightsSchema,
  handleGetInsights,
} from "./tools/get-insights.js";
import {
  getOntologySchema,
  handleGetOntology,
} from "./tools/get-ontology.js";
import {
  updateOntologySchema,
  handleUpdateOntology,
} from "./tools/update-ontology.js";
import {
  annotateThreadSchema,
  handleAnnotateThread,
} from "./tools/annotate-thread.js";
import {
  switchProjectSchema,
  handleSwitchProject,
} from "./tools/switch-project.js";
import {
  createProjectSchema,
  handleCreateProject,
} from "./tools/create-project.js";
import {
  getProjectSummarySchema,
  handleGetProjectSummary,
} from "./tools/get-project-summary.js";

export function createServer(config: InferConfig): McpServer {
  // Re-reads config from disk on each call so switch_project takes effect immediately
  async function getClient(): Promise<ApiClient> {
    try {
      const freshConfig = await loadConfig();
      return new ApiClient(freshConfig);
    } catch {
      return new ApiClient(config);
    }
  }

  const server = new McpServer({
    name: "infer-analytics",
    version: "0.1.0",
  });

  // Skills are now in a separate package (@inferevents/skills)
  // installed via: npx skills add infer-events/skills
  // The MCP server only provides tools, not skill resources.

  // --- Tools ---

  server.tool(
    "get_event_counts",
    "Count events over a time range, optionally grouped by a property. " +
      "Use this for questions like 'how many signups this week', " +
      "'page views by country last 30 days', or 'purchase count trend'.",
    getEventCountsSchema,
    async (params) => {
      try {
        const text = await handleGetEventCounts(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_retention",
    "Cohort-based retention analysis. Shows what percentage of users who performed " +
      "a start event came back to perform a return event. " +
      "Use for questions like 'what is our week-over-week retention', " +
      "'do users come back after signing up', or 'retention by monthly cohort'.",
    getRetentionSchema,
    async (params) => {
      try {
        const text = await handleGetRetention(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_user_journey",
    "Get the ordered sequence of events for a specific user. " +
      "Use for questions like 'what did user X do', 'show me this user's activity', " +
      "or 'trace a user's path through the app'. " +
      "To find user IDs: first call get_event_counts with group_by='anonymous_id' " +
      "to list anonymous user IDs, then pass one to this tool as user_id.",
    getUserJourneySchema,
    async (params) => {
      try {
        const text = await handleGetUserJourney(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_top_events",
    "List the most frequent events in a time range with counts and unique users. " +
      "Use for questions like 'what events are being tracked', 'what are users doing', " +
      "'show me all event types', or 'what's the most common action'.",
    getTopEventsSchema,
    async (params) => {
      try {
        const text = await handleGetTopEvents(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_insights",
    "Get automatically detected anomalies and notable patterns. " +
      "Call get_project_summary first for full context, then call this for specific alerts. " +
      "Returns pre-computed insights like volume drops, error spikes, milestones, " +
      "and new events with thread context. Insights are auto-detected hourly — no query needed.",
    getInsightsSchema,
    async (params) => {
      try {
        const text = await handleGetInsights(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_ontology",
    "View the event ontology — how events are classified into product categories " +
      "(activation, engagement, monetization, referral, noise) and funnel stages. " +
      "Use this to understand what events mean in the context of the product. " +
      "If empty, suggest classifying events with update_ontology.",
    getOntologySchema,
    async (params) => {
      try {
        const text = await handleGetOntology(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "update_ontology",
    "Classify events into product categories and funnel stages. " +
      "Use 'proposed' status when suggesting to the developer for confirmation, " +
      "'confirmed' when the developer has agreed. " +
      "Categories: activation (first value moment), engagement (ongoing usage), " +
      "monetization (revenue), referral (invites/shares), noise (high volume, low signal). " +
      "SDK-declared categories are automatically confirmed.",
    updateOntologySchema,
    async (params) => {
      try {
        const text = await handleUpdateOntology(await getClient(), params as Parameters<typeof handleUpdateOntology>[1]);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "annotate_thread",
    "REQUIRED after investigating any insight from get_insights. " +
      "Records your finding (root cause, contributing factors, resolution) into the thread. " +
      "This is what makes Infer compound — your annotation appears in every future session's " +
      "briefing and project summary. The thread_id and exact call are shown in get_insights output. " +
      "Skip only if the thread already has an annotation covering your finding.",
    annotateThreadSchema,
    async (params) => {
      try {
        const text = await handleAnnotateThread(await getClient(), params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "switch_project",
    "Switch between Infer projects or list all configured projects. " +
      "Use when the user says 'switch to project X' or 'list my projects' or " +
      "wants to query data from a different project.",
    switchProjectSchema,
    async (params) => {
      try {
        const text = await handleSwitchProject(params);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "create_project",
    "Create a new Infer project from the CLI. " +
      "Use when the user wants to add analytics to a new codebase. " +
      "Requires an active session from prior signup.",
    createProjectSchema,
    async (params) => {
      try {
        const freshConfig = await loadConfig().catch(() => config);
        const text = await handleCreateProject(params, freshConfig.endpoint);
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_project_summary",
    "Get a compiled overview of the project — health score, key metrics, event catalog, " +
      "funnel performance, and active insight threads. This is the analytics wiki — " +
      "always up to date, compiled hourly. " +
      "Call this first for full context, then get_insights for specific alerts.",
    getProjectSummarySchema,
    async () => {
      try {
        const text = await handleGetProjectSummary(await getClient());
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: formatError(error) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return `API Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error occurred`;
}
