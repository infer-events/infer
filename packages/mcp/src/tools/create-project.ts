import { z } from "zod";
import { addProject, readConfigFile, getSession } from "../config.js";

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
    return "No session found. Sign up at https://infer.events/signup first, then run /infer-setup.";
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
    return `Failed to create project: ${body.error ?? response.statusText}`;
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

  const lines = [
    `Project "${result.project_name}" created and set as active.`,
    "",
    `Project ID:  ${result.project_id}`,
    `Write key:   ${result.write_key}`,
    `Read key:    ${result.read_key}`,
    "",
    `Saved to ~/.infer/config.json as "${slug}" (now active).`,
    "",
    "Next: Install the SDK in your project with npm install @inferevents/sdk",
    `Then init with: init({ projectId: "${result.write_key}" })`,
  ];

  return lines.join("\n");
}
