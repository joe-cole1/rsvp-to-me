import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "tests/components/**", "tests/integration/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/actions/**/*.ts", "lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        "prisma/**",
        "scripts/**",
        "worker/**",
        "next.config.ts",
        "instrumentation.ts",
        "vitest.config.ts",
        "postcss.config.mjs",
        "eslint.config.mjs",
        "app/**/*.tsx",
        "app/**/layout.tsx",
        "app/**/page.tsx",
        "lib/db.ts",
        "lib/logger.ts",
        "lib/theme.ts",
      ],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
