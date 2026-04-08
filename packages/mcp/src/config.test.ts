import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:fs/promises before any imports that use it
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock/home",
}));

import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  loadConfig,
  switchProject,
  listProjects,
  addProject,
  readConfigFile,
  writeConfigFile,
  writeLocalConfig,
  ConfigError,
} from "./config.js";

const mockReadFile = vi.mocked(readFile);
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);

describe("config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean env vars before each test
    delete process.env.INFER_API_KEY;
    delete process.env.INFER_ENDPOINT;
    delete process.env.INFER_PROJECT_ID;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("loadConfig with env vars", () => {
    it("uses INFER_API_KEY when set", async () => {
      process.env.INFER_API_KEY = "pk_read_envkey";

      const config = await loadConfig();
      expect(config.apiKey).toBe("pk_read_envkey");
    });

    it("uses INFER_ENDPOINT when set", async () => {
      process.env.INFER_API_KEY = "pk_read_envkey";
      process.env.INFER_ENDPOINT = "https://custom.endpoint.com";

      const config = await loadConfig();
      expect(config.endpoint).toBe("https://custom.endpoint.com");
    });

    it("uses INFER_PROJECT_ID when set", async () => {
      process.env.INFER_API_KEY = "pk_read_envkey";
      process.env.INFER_PROJECT_ID = "proj_env123";

      const config = await loadConfig();
      expect(config.projectId).toBe("proj_env123");
    });

    it("defaults endpoint when INFER_ENDPOINT not set", async () => {
      process.env.INFER_API_KEY = "pk_read_envkey";

      const config = await loadConfig();
      expect(config.endpoint).toBe("https://api.infer.events");
    });

    it("skips file reading when env key is set", async () => {
      process.env.INFER_API_KEY = "pk_read_envkey";

      await loadConfig();
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe("loadConfig with config file", () => {
    it("reads from ~/.infer/config.json", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_read_filekey",
          endpoint: "https://api.infer.events",
          projectId: "proj_file",
        }),
      );

      await loadConfig();

      expect(mockReadFile).toHaveBeenCalledWith(
        "/mock/home/.infer/config.json",
        "utf-8",
      );
    });

    it("handles old flat format { apiKey, endpoint, projectId }", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_read_oldformat",
          endpoint: "https://old.api.com",
          projectId: "proj_old",
        }),
      );

      const config = await loadConfig();
      expect(config.apiKey).toBe("pk_read_oldformat");
      expect(config.endpoint).toBe("https://old.api.com");
      expect(config.projectId).toBe("proj_old");
    });

    it("strips trailing slashes from endpoint in old format", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_read_test",
          endpoint: "https://api.example.com///",
        }),
      );

      const config = await loadConfig();
      expect(config.endpoint).toBe("https://api.example.com");
    });

    it("handles new profiles format", async () => {
      mockReadFile.mockImplementation(async (path) => {
        if (typeof path === "string" && path.endsWith("config.json")) {
          return JSON.stringify({
            endpoint: "https://api.infer.events",
            activeProject: "my-app",
            projects: {
              "my-app": {
                apiKey: "pk_read_myapp",
                projectId: "proj_myapp",
              },
              "other-app": {
                apiKey: "pk_read_other",
                projectId: "proj_other",
              },
            },
          });
        }
        throw new Error("ENOENT");
      });

      const config = await loadConfig();
      expect(config.apiKey).toBe("pk_read_myapp");
      expect(config.projectId).toBe("proj_myapp");
    });

    it("uses first project when activeProject not set", async () => {
      mockReadFile.mockImplementation(async (path) => {
        if (typeof path === "string" && path.endsWith("config.json")) {
          return JSON.stringify({
            projects: {
              "first-proj": {
                apiKey: "pk_read_first",
                projectId: "proj_first",
              },
              "second-proj": {
                apiKey: "pk_read_second",
                projectId: "proj_second",
              },
            },
          });
        }
        throw new Error("ENOENT");
      });

      const config = await loadConfig();
      expect(config.apiKey).toBe("pk_read_first");
      expect(config.projectId).toBe("proj_first");
    });

    it("throws ConfigError when config file is missing", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      await expect(loadConfig()).rejects.toThrow(ConfigError);
      await expect(
        // Need to re-mock since the first call consumed the mock
        (mockReadFile.mockRejectedValueOnce(new Error("ENOENT")), loadConfig()),
      ).rejects.toThrow(/not configured/);
    });

    it("throws ConfigError when JSON is invalid", async () => {
      mockReadFile.mockResolvedValueOnce("not valid json {{{");

      await expect(loadConfig()).rejects.toThrow(ConfigError);
    });

    it("throws ConfigError when JSON is invalid with descriptive message", async () => {
      mockReadFile.mockResolvedValueOnce("not valid json {{{");

      await expect(loadConfig()).rejects.toThrow(/Invalid JSON/);
    });

    it('throws ConfigError when apiKey does not start with pk_read_', async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_write_wrongtype",
          endpoint: "https://api.infer.events",
        }),
      );

      await expect(loadConfig()).rejects.toThrow(ConfigError);
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_write_wrongtype",
          endpoint: "https://api.infer.events",
        }),
      );
      await expect(loadConfig()).rejects.toThrow(/read API key/);
    });

    it("throws ConfigError when no projects exist in profiles format", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          projects: {},
        }),
      );

      await expect(loadConfig()).rejects.toThrow(ConfigError);
    });

    it('throws ConfigError when project apiKey does not start with pk_read_', async () => {
      mockReadFile.mockImplementation(async (path) => {
        if (typeof path === "string" && path.endsWith("config.json")) {
          return JSON.stringify({
            activeProject: "bad-proj",
            projects: {
              "bad-proj": {
                apiKey: "sk_live_wrongprefix",
                projectId: "proj_bad",
              },
            },
          });
        }
        throw new Error("ENOENT");
      });

      await expect(loadConfig()).rejects.toThrow(ConfigError);
      await expect(loadConfig()).rejects.toThrow(/Invalid read key/);
    });

    it("defaults endpoint to https://api.infer.events in old format", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_read_noendpoint",
        }),
      );

      const config = await loadConfig();
      expect(config.endpoint).toBe("https://api.infer.events");
    });

    it("defaults endpoint in profiles format", async () => {
      mockReadFile.mockImplementation(async (path) => {
        if (typeof path === "string" && path.endsWith("config.json")) {
          return JSON.stringify({
            activeProject: "proj",
            projects: {
              proj: {
                apiKey: "pk_read_test",
                projectId: "proj_1",
              },
            },
          });
        }
        throw new Error("ENOENT");
      });

      const config = await loadConfig();
      expect(config.endpoint).toBe("https://api.infer.events");
    });
  });

  describe("project management", () => {
    describe("switchProject", () => {
      it("changes activeProject and returns config", async () => {
        const baseConfig = {
          endpoint: "https://api.infer.events",
          activeProject: "proj-a",
          projects: {
            "proj-a": { apiKey: "pk_read_a", projectId: "proj_a" },
            "proj-b": { apiKey: "pk_read_b", projectId: "proj_b" },
          },
        };

        // First call: readConfigFile reads original config
        // Second call: loadConfig reads the updated config (after writeConfigFile)
        mockReadFile
          .mockResolvedValueOnce(JSON.stringify(baseConfig))
          .mockResolvedValueOnce(
            JSON.stringify({ ...baseConfig, activeProject: "proj-b" }),
          );
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);

        const config = await switchProject("proj-b");

        // Should have written the updated config
        expect(mockWriteFile).toHaveBeenCalled();
        const writtenContent = JSON.parse(
          mockWriteFile.mock.calls[0]![1] as string,
        );
        expect(writtenContent.activeProject).toBe("proj-b");

        // Should return the loaded config for proj-b
        expect(config.apiKey).toBe("pk_read_b");
        expect(config.projectId).toBe("proj_b");
      });

      it("throws ConfigError for unknown project", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            activeProject: "proj-a",
            projects: {
              "proj-a": { apiKey: "pk_read_a", projectId: "proj_a" },
            },
          }),
        );

        await expect(switchProject("nonexistent")).rejects.toThrow(ConfigError);
        await expect(switchProject("nonexistent")).rejects.toThrow(
          /not found/,
        );
      });

      it("lists available projects in error message", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            projects: {
              alpha: { apiKey: "pk_read_a", projectId: "proj_a" },
              beta: { apiKey: "pk_read_b", projectId: "proj_b" },
            },
          }),
        );

        await expect(switchProject("gamma")).rejects.toThrow(/alpha/);
        await expect(switchProject("gamma")).rejects.toThrow(/beta/);
      });
    });

    describe("listProjects", () => {
      it("returns all projects with active flag", async () => {
        mockReadFile.mockResolvedValueOnce(
          JSON.stringify({
            activeProject: "prod",
            projects: {
              prod: { apiKey: "pk_read_prod", projectId: "proj_prod" },
              staging: { apiKey: "pk_read_stg", projectId: "proj_stg" },
            },
          }),
        );

        const projects = await listProjects();

        expect(projects).toHaveLength(2);
        expect(projects).toContainEqual({
          name: "prod",
          projectId: "proj_prod",
          active: true,
        });
        expect(projects).toContainEqual({
          name: "staging",
          projectId: "proj_stg",
          active: false,
        });
      });

      it("returns empty array when no projects", async () => {
        mockReadFile.mockResolvedValueOnce(
          JSON.stringify({ projects: {} }),
        );

        const projects = await listProjects();
        expect(projects).toEqual([]);
      });
    });

    describe("addProject", () => {
      it("adds to config and sets active by default", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            activeProject: "existing",
            projects: {
              existing: { apiKey: "pk_read_ex", projectId: "proj_ex" },
            },
          }),
        );
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);

        await addProject("new-proj", "pk_read_new", "proj_new");

        expect(mockWriteFile).toHaveBeenCalled();
        const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
        expect(written.projects["new-proj"]).toEqual({
          apiKey: "pk_read_new",
          projectId: "proj_new",
        });
        expect(written.activeProject).toBe("new-proj");
      });

      it("adds without setting active when setActive=false", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            activeProject: "existing",
            projects: {
              existing: { apiKey: "pk_read_ex", projectId: "proj_ex" },
            },
          }),
        );
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);

        await addProject("new-proj", "pk_read_new", "proj_new", undefined, false);

        const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
        expect(written.projects["new-proj"]).toBeDefined();
        expect(written.activeProject).toBe("existing");
      });

      it("stores writeKey when provided", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            projects: {},
          }),
        );
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);

        await addProject("proj", "pk_read_key", "proj_id", "pk_write_key");

        const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
        expect(written.projects["proj"].writeKey).toBe("pk_write_key");
      });

      it("stores session when provided", async () => {
        mockReadFile.mockResolvedValue(
          JSON.stringify({
            projects: {},
          }),
        );
        mockWriteFile.mockResolvedValue(undefined);
        mockMkdir.mockResolvedValue(undefined);

        await addProject("proj", "pk_read_key", "proj_id", undefined, true, "sess_123");

        const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string);
        expect(written.session).toBe("sess_123");
      });
    });
  });

  describe("readConfigFile", () => {
    it("migrates old flat format to profiles format", async () => {
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          apiKey: "pk_read_old",
          projectId: "proj_old",
          session: "sess_old",
        }),
      );

      const config = await readConfigFile();
      expect(config.activeProject).toBe("default");
      expect(config.projects.default).toEqual({
        apiKey: "pk_read_old",
        projectId: "proj_old",
        writeKey: undefined,
      });
      expect(config.session).toBe("sess_old");
    });

    it("returns empty config when file not found", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const config = await readConfigFile();
      expect(config.projects).toEqual({});
      expect(config.endpoint).toBe("https://api.infer.events");
    });
  });

  describe("writeConfigFile", () => {
    it("creates directory and writes config", async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await writeConfigFile({
        activeProject: "test",
        projects: {
          test: { apiKey: "pk_read_test", projectId: "proj_test" },
        },
      });

      expect(mockMkdir).toHaveBeenCalledWith("/mock/home/.infer", {
        recursive: true,
      });
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/mock/home/.infer/config.json",
        expect.any(String),
        "utf-8",
      );
    });

    it("writes valid JSON with trailing newline", async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const input = {
        activeProject: "test",
        projects: {
          test: { apiKey: "pk_read_test", projectId: "proj_test" },
        },
      };

      await writeConfigFile(input);

      const written = mockWriteFile.mock.calls[0]![1] as string;
      expect(written.endsWith("\n")).toBe(true);
      expect(JSON.parse(written)).toMatchObject(input);
    });
  });

  describe("ConfigError", () => {
    it('has name "ConfigError"', () => {
      const err = new ConfigError("test");
      expect(err.name).toBe("ConfigError");
    });

    it("extends Error", () => {
      const err = new ConfigError("test");
      expect(err).toBeInstanceOf(Error);
    });

    it("stores message", () => {
      const err = new ConfigError("something broke");
      expect(err.message).toBe("something broke");
    });
  });
});
