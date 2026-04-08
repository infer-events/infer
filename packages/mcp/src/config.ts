import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface InferConfig {
  apiKey: string;
  endpoint: string;
  projectId?: string;
}

export interface InferConfigFile {
  session?: string;
  activeProject?: string;
  endpoint?: string;
  projects: Record<string, {
    apiKey: string;
    projectId: string;
    writeKey?: string;
  }>;
}

const CONFIG_DIR = join(homedir(), ".infer");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const LOCAL_CONFIG_NAME = ".infer.json";

const SETUP_INSTRUCTIONS = `
Infer MCP server is not configured.

Run /infer-setup in Claude Code, or create ~/.infer/config.json:

  {
    "endpoint": "https://api.infer.events",
    "activeProject": "my-project",
    "projects": {
      "my-project": {
        "apiKey": "pk_read_...",
        "projectId": "proj_..."
      }
    }
  }
`.trim();

/**
 * Find local .infer.json by walking up from cwd.
 * Returns the parsed config or null if not found.
 */
async function findLocalConfig(): Promise<{ projectName: string } | null> {
  let dir = process.cwd();
  const root = (process.platform === "win32") ? dir.split("\\")[0]! + "\\" : "/";

  for (let i = 0; i < 10; i++) {
    try {
      const raw = await readFile(join(dir, LOCAL_CONFIG_NAME), "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.project === "string") {
        return { projectName: parsed.project as string };
      }
    } catch {
      // not found, walk up
    }
    const parent = join(dir, "..");
    if (parent === dir || dir === root) break;
    dir = parent;
  }
  return null;
}

export async function loadConfig(): Promise<InferConfig> {
  // 1. Env overrides (highest priority)
  const envKey = process.env.INFER_API_KEY;
  const envProject = process.env.INFER_PROJECT_ID;
  if (envKey) {
    return {
      apiKey: envKey,
      endpoint: process.env.INFER_ENDPOINT ?? "https://api.infer.events",
      projectId: envProject,
    };
  }

  // 2. Read global config
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch {
    throw new ConfigError(SETUP_INSTRUCTIONS);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(
      `Invalid JSON in ${CONFIG_PATH}. Please check the file syntax.`
    );
  }

  const config = parsed as Record<string, unknown>;

  // 3. Backwards compat: old flat format { apiKey, endpoint, projectId }
  if ("apiKey" in config && typeof config.apiKey === "string") {
    const apiKey = config.apiKey as string;
    if (!apiKey.startsWith("pk_read_")) {
      throw new ConfigError(
        `The MCP server requires a read API key (starts with "pk_read_").`
      );
    }
    return {
      apiKey,
      endpoint: typeof config.endpoint === "string"
        ? (config.endpoint as string).replace(/\/+$/, "")
        : "https://api.infer.events",
      projectId: typeof config.projectId === "string" ? config.projectId as string : undefined,
    };
  }

  // 4. New profiles format — determine active project
  if ("projects" in config && typeof config.projects === "object" && config.projects !== null) {
    const projects = config.projects as Record<string, Record<string, unknown>>;
    const names = Object.keys(projects);
    if (names.length === 0) {
      throw new ConfigError(`No projects in ${CONFIG_PATH}. Run /infer-setup to add one.`);
    }

    // Priority: local .infer.json > global activeProject > first project
    const localConfig = await findLocalConfig();
    let activeName: string;

    if (localConfig && projects[localConfig.projectName]) {
      activeName = localConfig.projectName;
    } else if (typeof config.activeProject === "string" && projects[config.activeProject as string]) {
      activeName = config.activeProject as string;
    } else {
      activeName = names[0]!;
    }

    const project = projects[activeName]!;

    const apiKey = project.apiKey as string;
    if (!apiKey || !apiKey.startsWith("pk_read_")) {
      throw new ConfigError(
        `Invalid read key for project "${activeName}" in ${CONFIG_PATH}.`
      );
    }

    return {
      apiKey,
      endpoint: typeof config.endpoint === "string"
        ? (config.endpoint as string).replace(/\/+$/, "")
        : "https://api.infer.events",
      projectId: typeof project.projectId === "string" ? project.projectId as string : undefined,
    };
  }

  throw new ConfigError(SETUP_INSTRUCTIONS);
}

/**
 * Write a local .infer.json to the given directory (or cwd).
 * This pins the directory to a specific project in the global config.
 */
export async function writeLocalConfig(projectName: string, dir?: string): Promise<string> {
  const target = join(dir ?? process.cwd(), LOCAL_CONFIG_NAME);
  await writeFile(target, JSON.stringify({ project: projectName }, null, 2) + "\n", "utf-8");
  return target;
}

export async function readConfigFile(): Promise<InferConfigFile> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Migrate old flat format
    if ("apiKey" in parsed && !("projects" in parsed)) {
      return {
        session: typeof parsed.session === "string" ? parsed.session as string : undefined,
        endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint as string : "https://api.infer.events",
        activeProject: "default",
        projects: {
          default: {
            apiKey: parsed.apiKey as string,
            projectId: (parsed.projectId as string) ?? "",
            writeKey: parsed.writeKey as string | undefined,
          },
        },
      };
    }

    return parsed as unknown as InferConfigFile;
  } catch {
    return { projects: {}, endpoint: "https://api.infer.events" };
  }
}

export async function writeConfigFile(config: InferConfigFile): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export async function addProject(
  name: string,
  apiKey: string,
  projectId: string,
  writeKey?: string,
  setActive = true,
  session?: string,
): Promise<void> {
  const config = await readConfigFile();
  config.projects[name] = { apiKey, projectId, writeKey };
  if (setActive) config.activeProject = name;
  if (session) config.session = session;
  await writeConfigFile(config);
}

export async function switchProject(name: string): Promise<InferConfig> {
  const config = await readConfigFile();
  if (!config.projects[name]) {
    const available = Object.keys(config.projects);
    throw new ConfigError(
      `Project "${name}" not found. Available: ${available.join(", ")}`
    );
  }
  config.activeProject = name;
  await writeConfigFile(config);
  return loadConfig();
}

export async function listProjects(): Promise<Array<{ name: string; projectId: string; active: boolean }>> {
  const config = await readConfigFile();
  return Object.entries(config.projects).map(([name, p]) => ({
    name,
    projectId: p.projectId,
    active: name === config.activeProject,
  }));
}

export async function getSession(): Promise<string | undefined> {
  const config = await readConfigFile();
  return config.session;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}
