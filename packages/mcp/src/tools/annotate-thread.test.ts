import { describe, it, expect } from "vitest";

function formatAnnotationResult(params: {
  threadId: string;
  content: string;
  annotationCount: number;
}): string {
  return [
    `Annotation saved to thread ${params.threadId}.`,
    `Total annotations: ${params.annotationCount}`,
    "",
    `Recorded: "${params.content}"`,
    "",
    "This finding will appear in future insight briefings and the project summary.",
  ].join("\n");
}

describe("annotation result formatter", () => {
  it("confirms annotation was saved", () => {
    const output = formatAnnotationResult({
      threadId: "thread-1",
      content: "Root cause: deploy abc123 broke the signup API",
      annotationCount: 2,
    });
    expect(output).toContain("Annotation saved to thread thread-1");
    expect(output).toContain("Total annotations: 2");
    expect(output).toContain("Root cause: deploy abc123");
    expect(output).toContain("future insight briefings");
  });
});
