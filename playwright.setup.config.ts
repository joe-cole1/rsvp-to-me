import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// A separate database and process prove first-run setup without demo fixtures.
export default defineConfig({
  ...base,
  testDir: "tests/regression",
  testMatch: "issue-877-first-run.e2e.ts",
  testIgnore: [],
  workers: 1,
  globalSetup: "./tests/e2e/setup-global-setup.ts",
  globalTeardown: undefined,
  outputDir: "/tmp/rsvp-setup-playwright",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/setup", open: "never" }]],
  webServer: {
    command: "npm start",
    url: `${process.env.PLAYWRIGHT_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
