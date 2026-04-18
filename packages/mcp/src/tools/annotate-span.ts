import type { ApiClient } from "../api-client.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export interface AnnotateSpanParams {
  span_id: string;
  content: string;
}

export async function handleAnnotateSpan(
  client: ApiClient,
  params: AnnotateSpanParams,
): Promise<string> {
  const result = await client.annotateSpan(params);
  return toolResponseText(
    wrapResult({
      primary: {
        annotation_id: result.annotation_id,
        span_id: params.span_id,
        content: params.content,
      },
      source: "annotations",
      caveats: [
        `Annotation is scoped to the authenticated project. Future calls to get_span("${params.span_id}") will surface it.`,
      ],
    }),
  );
}
