/**
 * Factory for deprecated-tool shims. Phase 4 retires 6 web-analytics tools
 * and splits annotate_thread into annotate_span + annotate_trace. All 7
 * old names become thin handlers that return a deterministic envelope
 * explaining the deprecation and pointing at replacement tools.
 *
 * After `sunset_on`, the server.ts registration should remove these shims
 * entirely and the tools become unregistered (MCP clients get "unknown tool"
 * errors). Spec §8.4.
 */

export interface DeprecationShimInput {
  toolName: string;
  replacementTools: string[];
  sunsetOn: string; // YYYY-MM-DD
  reason: string;
}

export interface ToolHandlerResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function buildDeprecationShim(
  input: DeprecationShimInput,
): () => Promise<ToolHandlerResponse> {
  if (!ISO_DATE_RE.test(input.sunsetOn)) {
    throw new Error(
      `buildDeprecationShim: sunset_on must be YYYY-MM-DD (got "${input.sunsetOn}")`,
    );
  }
  const parsed = new Date(`${input.sunsetOn}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.sunsetOn) {
    throw new Error(
      `buildDeprecationShim: sunset_on must be a real calendar date (got "${input.sunsetOn}")`,
    );
  }

  const replacementHint =
    input.replacementTools.length > 0
      ? `Use ${input.replacementTools.map((t) => `\`${t}\``).join(" or ")} instead.`
      : "This tool has no direct replacement in the LLM-observability surface.";

  const trimmedReason = input.reason?.trim() ?? "";
  const messageLines = [
    `\`${input.toolName}\` is deprecated and will be removed after ${input.sunsetOn}.`,
    replacementHint,
    trimmedReason ? `Reason: ${trimmedReason}` : "",
  ].filter(Boolean);

  const payload = {
    deprecated: true,
    tool_name: input.toolName,
    sunset_on: input.sunsetOn,
    replacement_tools: input.replacementTools,
    reason: input.reason,
    message: messageLines.join(" "),
  };

  return async (): Promise<ToolHandlerResponse> => ({
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  });
}
