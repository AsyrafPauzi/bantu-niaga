import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    environment: "node",
    // Test files that need a browser-like DOM declare it at the top with
    //   // @vitest-environment jsdom
    // (per-file directive). This keeps fast pure-logic tests on node.
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
