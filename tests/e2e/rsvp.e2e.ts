import { test, expect } from "@playwright/test";
import { PUBLIC_EVENT_SLUG } from "./fixtures";

const EVENT_SLUG = PUBLIC_EVENT_SLUG;

test.describe("Guest RSVP flow", () => {
  test("guest can RSVP to a public event without logging in", async ({ page }) => {
    await page.goto(`/e/${EVENT_SLUG}`);
    await expect(page.getByRole("heading", { name: /E2E Test Event/i })).toBeVisible({
      timeout: 10_000,
    });

    // Click the Going button to enter RSVP flow
    await page.getByRole("link", { name: "Going", exact: true }).click();
    await page.waitForURL(`**/e/${EVENT_SLUG}/rsvp**`);

    // Fill in name
    await page.getByPlaceholder("Your name (required)").fill("E2E Guest");

    // Submit
    await page.getByText("Confirm RSVP").click();

    // Should show confirmation
    await expect(page.getByText("You're in!")).toBeVisible({ timeout: 10_000 });
  });

  test("guest can edit RSVP via editToken in URL", async ({ page }) => {
    // First create an RSVP programmatically by going through the flow
    await page.goto(`/e/${EVENT_SLUG}/rsvp?status=GOING`);
    await page.getByPlaceholder("Your name (required)").fill("Edit Test Guest");
    await page.getByText("Confirm RSVP").click();
    await expect(page.getByText("You're in!")).toBeVisible({ timeout: 10_000 });

    // The URL should now contain an editToken
    const url = new URL(page.url());
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();

    // Navigate back to edit the RSVP
    await page.goto(`/e/${EVENT_SLUG}/rsvp?token=${token}`);
    await expect(page.getByRole("button", { name: "Update RSVP" })).toBeVisible();

    // Change status to Maybe
    await page.getByText("Maybe").click();
    await page.getByRole("button", { name: "Update RSVP" }).click();
    await expect(page.getByText("RSVP updated!")).toBeVisible({ timeout: 10_000 });
  });

  test("guest name is required before RSVP submission", async ({ page }) => {
    await page.goto(`/e/${EVENT_SLUG}/rsvp?status=GOING`);
    await expect(page.getByRole("button", { name: "Confirm RSVP" })).toBeDisabled();
    await page.getByPlaceholder("Your name (required)").fill("   ");
    await expect(page.getByRole("button", { name: "Confirm RSVP" })).toBeDisabled();
  });

  test("invalid edit token does not expose an RSVP", async ({ page }) => {
    const response = await page.goto(`/e/${EVENT_SLUG}/rsvp?token=invalid-edit-token`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("button", { name: "Update RSVP" })).toHaveCount(0);
  });
});
