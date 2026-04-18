import { z } from "zod";
import { addProject, readConfigFile, getSession } from "../config.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export const createProjectSchema = {
  project_name: z
    .string()
    .describe("Name for the new project (e.g., 'my-saas-app', 'mobile-app')"),
  session: z
    .string()
    .optional()
    .describe("Session token from infer.events login. If omitted, uses the saved session from ~/.infer/config.json."),
};

export async function handleCreateProject(
  params: { project_name: string; session?: string },
  endpoint: string,
): Promise<string> {
  const config = await readConfigFile();

  // Use provided session, fall back to saved session from config
  let session = params.session;
  if (!session) {
    session = await getSession();
  }
  if (!session) {
    return toolResponseText(
      wrapResult({
        primary: {
          status: "error",
          error: "no_session",
          message:
            "No session found. Sign up at https://infer.events/signup first, then run /infer-setup.",
        },
        source: "config",
      }),
    );
  }

  const baseUrl = config.endpoint ?? endpoint;

  // Call the API to create the project
  const response = await fetch(`${baseUrl}/v1/auth/create-project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, project_name: params.project_name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return toolResponseText(
      wrapResult({
        primary: {
          status: "error",
          error: "create_failed",
          status_code: response.status,
          message: `Failed to create project: ${body.error ?? response.statusText}`,
        },
        source: "config",
      }),
    );
  }

  const result = await response.json() as {
    project_id: string;
    project_name: string;
    write_key: string;
    read_key: string;
    endpoint: string;
  };

  // Save to config
  const slug = params.project_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  await addProject(slug, result.read_key, result.project_id, result.write_key, true);

  const setupInstructions = [
    `Project "${result.project_name}" created and set as active.`,
    "",
    `Project ID:  ${result.project_id}`,
    `Write key:   ${result.write_key}`,
    `Read key:    ${result.read_key}`,
    "",
    `Saved to ~/.infer/config.json as "${slug}" (now active).`,
    "",
    "Next: route your LLM traffic through the Infer gateway using the write key " +
      "(pk_write_*) as your provider's API key. The read key (pk_read_*) is for MCP access.",
  ].join("\n");

  return toolResponseText(
    wrapResult({
      primary: {
        status: "created",
        project_id: result.project_id,
        project_name: result.project_name,
        project_slug: slug,
        read_key: result.read_key,
        write_key: result.write_key,
        endpoint: result.endpoint,
        active: true,
        setup_instructions_text: setupInstructions,
      },
      source: "config",
      caveats: [
        "Save the read_key (pk_read_*) for MCP access and the write_key (pk_write_*) for gateway BYOK calls. These are shown ONCE.",
      ],
    }),
  );
}
