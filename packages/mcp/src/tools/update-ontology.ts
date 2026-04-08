import { z } from "zod";
import type { ApiClient } from "../api-client.js";

export const updateOntologySchema = {
  entries: z
    .array(
      z.object({
        event_name: z.string().describe("The event name to classify"),
        category: z
          .enum(["activation", "engagement", "monetization", "referral", "noise"])
          .describe("Product category for this event"),
        funnel_stage: z
          .number()
          .int()
          .optional()
          .describe("Optional funnel position (0 = earliest). Events are ordered by this value."),
        description: z
          .string()
          .optional()
          .describe("Optional human-readable description of what this event means"),
        success_indicator: z
          .boolean()
          .optional()
          .describe("Whether this event indicates a successful outcome (default false)"),
        status: z
          .enum(["proposed", "confirmed", "rejected"])
          .default("confirmed")
          .describe("Status of this classification. Use 'proposed' when suggesting to the developer, 'confirmed' when the developer agrees."),
      })
    )
    .min(1)
    .max(100)
    .describe("List of event ontology entries to create or update"),
};

export async function handleUpdateOntology(
  client: ApiClient,
  params: { entries: Array<{
    event_name: string;
    category: string;
    funnel_stage?: number;
    description?: string;
    success_indicator?: boolean;
    status?: string;
  }> }
): Promise<string> {
  const result = await client.updateOntology(params.entries);

  const lines: string[] = [];

  if (result.updated === result.total) {
    lines.push(`Updated ${result.updated} event ontology entries.`);
  } else {
    lines.push(`Updated ${result.updated} of ${result.total} entries.`);
  }

  lines.push("");
  lines.push("Summary of changes:");

  for (const entry of params.entries) {
    const status = entry.status ?? "confirmed";
    const stage = entry.funnel_stage !== undefined ? ` (stage ${entry.funnel_stage})` : "";
    lines.push(`  ${entry.event_name} → ${entry.category}${stage} [${status}]`);
  }

  lines.push("");
  lines.push("Use `get_ontology` to view the full event ontology.");

  return lines.join("\n");
}
