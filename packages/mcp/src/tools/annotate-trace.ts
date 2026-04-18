import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface AnnotateTraceParams {
  trace_id: string;
  content: string;
}

export async function handleAnnotateTrace(
  client: ApiClient,
  params: AnnotateTraceParams,
): Promise<string> {
  const result = await client.annotateTrace(params);
  return toolResponseText(
    wrapResult({
      primary: {
        annotation_id: result.annotation_id,
        trace_id: params.trace_id,
        content: params.content,
      },
      source: "annotations",
      caveats: [
        "Trace-level annotation — applies to the whole multi-span turn, not a single span.",
      ],
    }),
  );
}
