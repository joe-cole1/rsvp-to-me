import { test, expect } from "@playwright/test";
import { readAuthCookies } from "./fixtures";

test.describe("Info-only events without RSVPs (#843)", () => {
  test("host creates an info-only event with questions and a poll, and a visitor participates without RSVPing", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    await hostContext.addCookies(readAuthCookies());
    const hostPage = await hostContext.newPage();

    const title = `E2E Info Only Flyer ${Date.now()}`;
    await hostPage.goto("/dashboard/events/new");
    await hostPage.getByPlaceholder("Wine Night at Jane's").fill(title);
    await hostPage.locator('input[name="startDate"]').fill("2031-09-20");
    await hostPage.locator('input[name="startTime"]').fill("17:00");
    await hostPage.getByRole("switch", { name: /Collect RSVPs/i }).click();
    await hostPage.getByLabel("Public").check();
    await hostPage.getByRole("button", { name: /Create Event/ }).click();

    await hostPage.waitForURL(/\/e\/.+/);
    const eventUrl = new URL(hostPage.url());
    const slug = eventUrl.pathname.replace(/^\/e\//, "").replace(/\/$/, "");

    // Host bar replaces Invite/Message with Share and hides RSVP/GuestList cards
    await expect(hostPage.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(hostPage.getByRole("button", { name: "Invite" })).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: "Message" })).toHaveCount(0);

    // Add a custom question
    await hostPage.goto(`/e/${slug}/settings?section=questionnaire`);
    await hostPage.getByRole("button", { name: /Add Question/i }).click();
    await hostPage.getByPlaceholder("Question text *").fill("Which workshop?");
    await hostPage.getByRole("button", { name: "Add Question" }).click();
    await expect(hostPage.locator(`input[value="Which workshop?"]`)).toBeVisible({
      timeout: 10_000,
    });

    // Add a poll (no requireRsvp checkbox on info-only events)
    await hostPage.goto(`/e/${slug}/settings?section=polls`);
    await hostPage.getByRole("button", { name: /Add Poll/i }).click();
    await expect(hostPage.getByText(/Require RSVP/i)).toHaveCount(0);
    await hostPage.getByPlaceholder(/Ask a question/).fill("Snacks?");
    await hostPage.getByPlaceholder("Option 1").fill("Fruit");
    await hostPage.getByPlaceholder("Option 2").fill("Cookies");
    await hostPage.getByRole("button", { name: "Create Poll" }).click();
    await expect(hostPage.getByText("Snacks?")).toBeVisible({ timeout: 10_000 });

    // Anonymous visitor opens event page
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    // /rsvp and /guests redirect back to /e/[slug]
    await guestPage.goto(`/e/${slug}/rsvp`);
    await expect(guestPage).toHaveURL(new RegExp(`/e/${slug}$`));
    await guestPage.goto(`/e/${slug}/guests`);
    await expect(guestPage).toHaveURL(new RegExp(`/e/${slug}$`));

    // No RSVP card is shown
    await expect(guestPage.getByRole("link", { name: "Going" })).toHaveCount(0);

    // Submit standalone questionnaire
    await guestPage.getByPlaceholder("Your name").first().fill("Casey");
    await guestPage.getByLabel("Which workshop?").fill("Pottery");
    await guestPage.getByRole("button", { name: "Submit answers" }).click();
    await expect(guestPage.getByText("Your answers have been saved.")).toBeVisible({
      timeout: 10_000,
    });

    // Vote in poll without RSVPing
    await guestPage.getByLabel("Cookies").check();
    await expect(guestPage.getByText(/100% \(1\)/)).toBeVisible({ timeout: 10_000 });

    // Post comment without RSVPing
    await guestPage.getByPlaceholder("Leave a comment…").fill("Looking forward to this!");
    await guestPage.getByRole("button", { name: "Leave a comment…" }).click();
    await expect(guestPage.getByText("Looking forward to this!")).toBeVisible({ timeout: 10_000 });

    // Host sees questionnaire response in Settings & CSV
    await hostPage.goto(`/e/${slug}/settings?section=questionnaire`);
    await expect(hostPage.getByText("Casey")).toBeVisible({ timeout: 10_000 });
    await expect(hostPage.getByText("Pottery")).toBeVisible();
    const csvRes = await hostContext.request.get(`/e/${slug}/questionnaire.csv`);
    expect(csvRes.status()).toBe(200);
    expect(await csvRes.text()).toContain("Pottery");

    await guestContext.close();
    await hostContext.close();
  });
});
