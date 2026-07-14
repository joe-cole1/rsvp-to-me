import { test, expect } from "@playwright/test";
import { readMagicToken } from "./fixtures";

test.describe("Auth flow", () => {
  // Verify test must run before sign-in test: createMagicLink invalidates all
  // existing tokens for a user, so submitting the sign-in form burns the seeded token.
  test("magic link creates a session that can be signed out", async ({ page }) => {
    const rawToken = readMagicToken();
    await page.goto(`/auth/verify?token=${rawToken}`);
    await page.waitForURL("**/dashboard**", { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);

    await page.goto("/auth/sign-out");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("invalid magic link is rejected without creating a session", async ({ page }) => {
    await page.goto("/auth/verify?token=not-a-valid-e2e-token");
    await expect(page).toHaveURL(/\/auth\/sign-in\?error=invalid-token/);
    await expect(page.getByText(/expired or already been used/i)).toBeVisible();
  });

  test("anonymous dashboard access redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
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
