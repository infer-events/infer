import { z } from "zod";
import type { ApiClient } from "../api-client.js";

export const getOntologySchema = {
  status: z
    .enum(["proposed", "confirmed", "rejected"])
    .optional()
    .describe("Filter by status. Omit to get all entries."),
};

export async function handleGetOntology(
  client: ApiClient,
  params: { status?: string }
): Promise<string> {
  const result = await client.getOntology({
    status: params.status,
  });

  if (result.total === 0) {
    return (
      "No event ontology configured yet.\n\n" +
      "The event ontology maps your event names to product categories " +
      "(activation, engagement, monetization, referral, noise) so Infer can " +
      "generate richer insights like funnel bottlenecks and activation rates.\n\n" +
      "Two ways to populate it:\n" +
      "1. SDK hints: `infer.track('purchase', { amount: 99 }, { category: 'monetization' })`\n" +
      "2. Use the `update_ontology` tool to classify events now.\n\n" +
      "Would you like me to look at your top events and propose categories?"
    );
  }

  const categoryIcon: Record<string, string> = {
    activation: "A",
    engagement: "E",
    monetization: "M",
    referral: "R",
    noise: "~",
  };

  const statusIcon: Record<string, string> = {
    confirmed: "✓",
    proposed: "?",
    rejected: "✗",
  };

  const chart: string[] = [
    `Event Ontology — ${result.total} events mapped`,
    `${"─".repeat(50)}`,
    "",
  ];

  // Group by category
  const byCategory = new Map<string, typeof result.entries>();
  for (const entry of result.entries) {
    const cat = entry.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(entry);
  }

  for (const [category, entries] of byCategory) {
    const icon = categoryIcon[category] ?? "?";
    chart.push(`[${icon}] ${category.toUpperCase()}`);

    for (const entry of entries) {
      const sIcon = statusIcon[entry.status] ?? "?";
      const stage = entry.funnel_stage !== null ? ` (stage ${entry.funnel_stage})` : "";
      const desc = entry.description ? ` — ${entry.description}` : "";
      const source = entry.source === "sdk" ? "sdk" : "agent";
      chart.push(`    ${sIcon} ${entry.event_name}${stage}${desc}  [${source}]`);
    }
    chart.push("");
  }

  const output = "Present this to the user exactly as-is:\n\n```\n" + chart.join("\n") + "```";
  return output;
}
