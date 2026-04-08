import { z } from "zod";
import { listProjects, switchProject, writeLocalConfig } from "../config.js";

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
      return "No projects configured. Run /infer-setup to create one.";
    }
    const lines = ["Your Infer projects:", ""];
    for (const p of projects) {
      const marker = p.active ? " (active)" : "";
      lines.push(`  ${p.name} — ${p.projectId}${marker}`);
    }
    lines.push("", "To switch: call switch_project with the project name.");
    return lines.join("\n");
  }

  const config = await switchProject(params.project_name);
  // Also write .infer.json in current directory so this project auto-selects here
  const localPath = await writeLocalConfig(params.project_name).catch(() => null);
  const localMsg = localPath ? ` Wrote .infer.json so this directory always uses "${params.project_name}".` : "";
  return `Switched to project "${params.project_name}" (${config.projectId}).${localMsg} MCP tools now query this project.`;
}
