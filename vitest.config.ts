import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "sdk",
          root: "./packages/sdk",
          environment: "jsdom",
          include: ["src/**/*.test.ts"],
          tsconfig: "./tsconfig.test.json",
        },
      },
      {
        test: {
          name: "mcp",
          root: "./packages/mcp",
          environment: "node",
          include: ["src/**/*.test.ts"],
          tsconfig: "./tsconfig.test.json",
        },
      },
    ],
  },
});
