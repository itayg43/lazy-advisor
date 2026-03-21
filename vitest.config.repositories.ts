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
    include: ["src/**/repositories/**/*.test.ts"],
    fileParallelism: false,
  },
});
