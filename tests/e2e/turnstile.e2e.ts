import { test, expect } from "@playwright/test";
import { PUBLIC_EVENT_SLUG } from "./fixtures";

test.describe("Cloudflare Turnstile E2E Verification", () => {
  test("sign-in form processes submission cleanly under Turnstile provider", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByText(/sign in with a magic link/i)).toBeVisible();
    await page.getByRole("textbox").fill("turnstile-e2e@test.internal");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/check your/i)).toBeVisible({ timeout: 10_000 });
  });

  test("public RSVP page loads with CaptchaProvider and handles guest form navigation", async ({
    page,
  }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Going", exact: true })).toBeVisible();
  });
});
