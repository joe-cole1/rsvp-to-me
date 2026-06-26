import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Auth flow", () => {
  test("sign-in page renders and accepts email input", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await page.getByRole("textbox").fill("test@example.com");
    await page.getByRole("button", { name: /send/i }).click();
    // Should show a "check your email/phone" confirmation state
    await expect(page.getByText(/check your/i)).toBeVisible({ timeout: 10_000 });
  });

  test("magic link verify flow: valid token redirects to dashboard", async ({ page }) => {
    const tokenPath = path.join(__dirname, "fixtures", "magic-token.txt");
    if (!fs.existsSync(tokenPath)) {
      test.skip(true, "magic-token.txt not found (global-setup may not have run)");
      return;
    }
    const rawToken = fs.readFileSync(tokenPath, "utf-8").trim();
    await page.goto(`/auth/verify?token=${rawToken}`);
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});
