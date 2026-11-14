import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// A separate production process prevents inherited keys or a reused disabled
// server from silently turning the enabled-CAPTCHA check into a skipped test.
export default defineConfig({
  ...base,
  testMatch: "**/csp-turnstile.e2e.ts",
  testIgnore: [],
  outputDir: "/tmp/rsvp-turnstile-playwright",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/turnstile", open: "never" }]],
  webServer: {
    command: "npm start -- --port 3003",
    url: "http://localhost:3003/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
