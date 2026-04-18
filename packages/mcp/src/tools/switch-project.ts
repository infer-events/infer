import { z } from "zod";
import { listProjects, switchProject, writeLocalConfig } from "../config.js";
import { wrapResult, toolResponseText } from "../tool-result.js";

export const switchProjectSchema = {
  project_name: z
    .string()
    .optional()
    .describe("Name of the project to switch to. Omit to list all projects."),
};

export async function handleSwitchProject(
  params: { project_name?: string }
): Promise<string> {
  const projects = await listProjects();

  if (!params.project_name) {
    if (projects.length === 0) {
      return toolResponseText(
        wrapResult({
          primary: {
            status: "empty",
            projects: [],
            message: "No projects configured. Run /infer-setup to create one.",
          },
          source: "config",
        }),
      );
    }
    const lines = ["Your Infer projects:", ""];
    for (const p of projects) {
      const marker = p.active ? " (active)" : "";
      lines.push(`  ${p.name} — ${p.projectId}${marker}`);
    }
    lines.push("", "To switch: call switch_project with the project name.");
    return toolResponseText(
      wrapResult({
        primary: {
          status: "listed",
          projects: projects.map((p) => ({
            name: p.name,
            project_id: p.projectId,
            active: p.active,
          })),
          rendered_text: lines.join("\n"),
        },
        source: "config",
      }),
    );
  }

  const config = await switchProject(params.project_name);
  // Also write .infer.json in current directory so this project auto-selects here
  const localPath = await writeLocalConfig(params.project_name).catch(() => null);
  const localMsg = localPath
    ? ` Wrote .infer.json so this directory always uses "${params.project_name}".`
    : "";
  const message = `Switched to project "${params.project_name}" (${config.projectId}).${localMsg} MCP tools now query this project.`;

  return toolResponseText(
    wrapResult({
      primary: {
        status: "switched",
        project_name: params.project_name,
        project_id: config.projectId,
        wrote_local_config: localPath !== null,
        local_config_path: localPath,
        message,
      },
      source: "config",
    }),
  );
}
