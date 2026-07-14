import { test, expect } from "@playwright/test";
import {
  PASSWORD_EVENT_PASSWORD,
  PASSWORD_EVENT_SLUG,
  PRIVATE_EVENT_SLUG,
  PUBLIC_EVENT_SLUG,
} from "./fixtures";

test.describe("Event access controls", () => {
  test("anonymous visitor cannot view a private event", async ({ page }) => {
    await page.goto(`/e/${PRIVATE_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { name: "This is a private event" })).toBeVisible();
    await expect(page.getByText("E2E Private Event")).toHaveCount(0);
  });

  test("password event rejects an incorrect password and unlocks with the correct one", async ({
    page,
  }) => {
    await page.goto(`/e/${PASSWORD_EVENT_SLUG}`);
    await page.getByPlaceholder("Event password").fill("incorrect-password");
    await page.getByRole("button", { name: "Enter Event" }).click();
    await expect(page.getByText("Incorrect password")).toBeVisible();

    await page.getByPlaceholder("Event password").fill(PASSWORD_EVENT_PASSWORD);
    await page.getByRole("button", { name: "Enter Event" }).click();
    await expect(page.getByRole("heading", { name: "E2E Password Event" })).toBeVisible();
  });

  test("protected RSVP and guest-list routes redirect to the event gate", async ({ page }) => {
    await page.goto(`/e/${PASSWORD_EVENT_SLUG}/rsvp?status=GOING`);
    await expect(page).toHaveURL(new RegExp(`/e/${PASSWORD_EVENT_SLUG}$`));
    await expect(page.getByPlaceholder("Event password")).toBeVisible();

    await page.goto(`/e/${PASSWORD_EVENT_SLUG}/guests`);
    await expect(page).toHaveURL(new RegExp(`/e/${PASSWORD_EVENT_SLUG}$`));
    await expect(page.getByPlaceholder("Event password")).toBeVisible();
  });

  test("calendar and CSV endpoints enforce their access boundaries", async ({ request }) => {
    const publicCalendar = await request.get(`/e/${PUBLIC_EVENT_SLUG}/calendar.ics`);
    expect(publicCalendar.status()).toBe(200);
    expect(await publicCalendar.text()).toContain("E2E Test Event");

    const privateCalendar = await request.get(`/e/${PRIVATE_EVENT_SLUG}/calendar.ics`);
    expect(privateCalendar.status()).toBe(404);

    const passwordCalendar = await request.get(`/e/${PASSWORD_EVENT_SLUG}/calendar.ics`);
    expect(passwordCalendar.status()).toBe(404);

    const anonymousCsv = await request.get(`/e/${PUBLIC_EVENT_SLUG}/guests.csv`);
    expect(anonymousCsv.status()).toBe(401);
  });
});
