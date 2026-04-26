import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    isolate: true,
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/**", "_worktrees/**"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
