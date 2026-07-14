import { test, expect } from "@playwright/test";
import {
  CREATED_EVENT_SLUG,
  CREATED_EVENT_TITLE,
  PUBLIC_EVENT_SLUG,
  readAuthCookies,
} from "./fixtures";

test.describe("Host event management", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies(readAuthCookies());
  });

  test("authenticated host sees host controls on their event page", async ({ page }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
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

  test("host can open event settings", async ({ page }) => {
    await page.goto(`/e/${PUBLIC_EVENT_SLUG}/settings`);
    await expect(page.getByRole("heading", { name: "Event Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Display Options/ })).toBeVisible();
  });

  test("host can create an event and see the published page", async ({ page }) => {
    await page.goto("/dashboard/events/new");
    await page.getByPlaceholder("Wine Night at Jane's").fill(CREATED_EVENT_TITLE);
    await page.locator('input[name="startDate"]').fill("2031-06-15");
    await page.locator('input[name="startTime"]').fill("19:30");
    await page.getByRole("button", { name: /TBD/ }).click();
    await page.getByLabel("Public").check();
    await page.getByRole("button", { name: /Create Event/ }).click();

    await page.waitForURL(`**/e/${CREATED_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { name: CREATED_EVENT_TITLE })).toBeVisible();
  });
});
