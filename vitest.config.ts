import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#shared": path.resolve(import.meta.dirname, "src/shared"),
      "#server": path.resolve(import.meta.dirname, "src/server"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
    },
  },
});
