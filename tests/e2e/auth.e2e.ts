import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Auth flow", () => {
  // Verify test must run before sign-in test: createMagicLink invalidates all
  // existing tokens for a user, so submitting the sign-in form burns the seeded token.
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

  test("sign-in page renders and accepts email input", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByText(/sign in with a magic link/i)).toBeVisible();
    await page.getByRole("textbox").fill("e2e-host@test.internal");
    await page.getByRole("button", { name: /send/i }).click();
    // Should show a "check your email/phone" confirmation state
    await expect(page.getByText(/check your/i)).toBeVisible({ timeout: 10_000 });
  });
});
