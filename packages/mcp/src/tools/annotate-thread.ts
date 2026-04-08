import { z } from "zod";
import type { ApiClient } from "../api-client.js";

export const annotateThreadSchema = {
  thread_id: z.string().describe("The thread ID to annotate (from get_insights thread context)."),
  content: z.string().max(2000).describe(
    "Your finding or conclusion about this thread. " +
    'E.g., "Root cause: deploy abc123 broke the signup API endpoint." ' +
    "This will appear in future insight briefings and the project summary.",
  ),
};

export async function handleAnnotateThread(
  client: ApiClient,
  params: { thread_id: string; content: string },
): Promise<string> {
  const result = await client.annotateThread({
    threadId: params.thread_id,
    content: params.content,
    source: "agent",
  });

  return [
    `Annotation saved to thread ${result.thread_id}.`,
    `Total annotations: ${result.annotation_count}`,
    "",
    `Recorded: "${params.content}"`,
    "",
    "This finding will appear in future insight briefings and the project summary.",
  ].join("\n");
}
