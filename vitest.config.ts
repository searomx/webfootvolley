import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve("src"),
      "server-only": path.resolve("tests/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: process.env.RUN_INTEGRATION === "true" ? [] : ["tests/integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
