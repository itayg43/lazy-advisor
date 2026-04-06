import path from "node:path";

import { defineConfig } from "vitest/config";

import { EvalRunReporter } from "./src/server/pipeline/eval.reporter";

export default defineConfig({
  resolve: {
    alias: {
      "#server": path.resolve(import.meta.dirname, "src/server"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.eval.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    reporters: ["default", new EvalRunReporter()],
  },
});
