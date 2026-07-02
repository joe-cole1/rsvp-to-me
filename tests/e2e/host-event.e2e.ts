import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

function getAuthState() {
  const authPath = path.join(__dirname, "fixtures", "auth-state.json");
  if (!fs.existsSync(authPath)) return null;
  return JSON.parse(fs.readFileSync(authPath, "utf-8"));
}

test.describe("Host event management", () => {
  test.beforeEach(async ({ context }) => {
    const authState = getAuthState();
    if (!authState) {
      test.skip();
      return;
    }
    await context.addCookies(authState.cookies);
  });

  test("authenticated host sees host controls on their event page", async ({ page }) => {
    await page.goto("/e/e2e-test-event");
    await expect(page.getByText("E2E Test Event")).toBeVisible();
    // Host bar or settings link should be visible for the host
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard shows the host's events", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByRole("link", { name: "E2E Test Event" }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
