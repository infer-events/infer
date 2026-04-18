/**
 * Shared result envelope for every active MCP tool. Spec §7.2.
 *
 * Rules:
 * - `primary` is the tool-specific payload — each tool defines its own type.
 * - `warnings[]` flag data-quality concerns the agent should surface (small
 *   sample sizes, estimated tokens, missing pricing entries, truncated streams).
 * - `caveats[]` note methodology (p95 computed on N=…; 7-day baseline, etc).
 * - `as_of` is the wall-clock of this query — stable anchor for agent recall.
 * - `source` tells the agent where the data came from so it can reason about
 *   freshness and trustworthiness.
 */

export type ToolResultSource =
  | "spans"
  | "insights"
  | "annotations"
  | "project_summary"
  | "config"
  | "pricing_table";

export interface ToolResult<T> {
  primary: T;
  warnings: string[];
  caveats: string[];
  as_of: string;
  source: ToolResultSource;
}

export function wrapResult<T>(input: {
  primary: T;
  source: ToolResultSource;
  warnings?: string[];
  caveats?: string[];
  asOf?: string;
}): ToolResult<T> {
  return {
    primary: input.primary,
    warnings: input.warnings ? [...input.warnings] : [],
    caveats: input.caveats ? [...input.caveats] : [],
    as_of: input.asOf ?? new Date().toISOString(),
    source: input.source,
  };
}

/**
 * Serialize a result envelope as a single JSON-in-text MCP response body.
 * The MCP SDK's `content[].text` is the user-visible channel; embedding
 * JSON lets the agent parse structured fields deterministically.
 */
export function toolResponseText<T>(envelope: ToolResult<T>): string {
  return JSON.stringify(envelope, null, 2);
}
