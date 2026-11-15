import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import { Pool } from "pg";
import { E2E_HOST_EMAIL, PUBLIC_EVENT_SLUG } from "./fixtures";

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

  test("guest name errors are announced and focused before RSVP submission", async ({ page }) => {
    await page.goto(`/e/${EVENT_SLUG}/rsvp?status=GOING`);
    const name = page.getByRole("textbox", { name: "Your name (required)" });
    const submit = page.getByRole("button", { name: "Confirm RSVP" });
    await submit.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Check the highlighted fields."
    );
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await name.fill("   ");
    await name.press("Enter");
    await expect(name).toBeFocused();
    await expect(name).toHaveAccessibleDescription("Enter your name.");
  });

  test("invalid edit token does not expose an RSVP", async ({ page }) => {
    const response = await page.goto(`/e/${EVENT_SLUG}/rsvp?token=invalid-edit-token`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("button", { name: "Update RSVP" })).toHaveCount(0);
  });
});

test.describe("#712 personalized invitation details journey", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const visibility of ["PUBLIC", "PRIVATE"] as const) {
    for (const [status, label] of [
      ["GOING", "Going"],
      ["MAYBE", "Maybe"],
      ["NO", "Can't go"],
    ] as const) {
      test(`${visibility} invited guest responds ${status} through event details`, async ({
        page,
        context,
      }) => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const eventId = randomUUID();
        const rsvpId = randomUUID();
        const editToken = randomUUID();
        const slug = `e2e-issue712-${visibility.toLowerCase()}-${status.toLowerCase()}-${eventId}`;
        const guestName = "Issue 712 Invited Guest";

        try {
          const host = await pool.query<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [
            E2E_HOST_EMAIL,
          ]);
          expect(host.rows).toHaveLength(1);
          await pool.query(
            `INSERT INTO "Event" (id, slug, title, status, visibility, "startAt", timezone,
              "locationType", "hostId", "maybeEnabled", "approvalRequired", "hostAlertEmail",
              "hostAlertSms", "createdAt", "updatedAt")
             VALUES ($1, $2, 'Issue 712 Invitation Event', 'PUBLISHED'::"EventStatus",
              $3::"Visibility", '2099-12-01T20:00:00Z', 'America/New_York',
              'PHYSICAL'::"LocationType", $4, true, false, false, false, now(), now())`,
            [eventId, slug, visibility, host.rows[0].id]
          );
          // No email, phone, or user identity: this fixture never sends guest confirmations.
          await pool.query(
            `INSERT INTO "RSVP" (id, "eventId", "guestName", status, "editToken", approved,
              responded, "plusOneCount", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, 'INVITED'::"RSVPStatus", $4, true, false, 0, now(), now())`,
            [rsvpId, eventId, guestName, editToken]
          );

          expect((await context.cookies()).some((cookie) => cookie.name === "rsvp-session")).toBe(
            false
          );
          if (visibility === "PRIVATE") {
            await page.goto(`/e/${slug}`);
            await expect(page.getByText("This is a private event", { exact: true })).toBeVisible();
          }
          await page.goto(`/e/${slug}?token=${editToken}`);
          await expect(
            page.getByRole("heading", { name: "Issue 712 Invitation Event", exact: true })
          ).toBeVisible();
          await page.getByRole("link", { name: label, exact: true }).click();
          await page.waitForURL((url) => url.pathname === `/e/${slug}/rsvp`);
          const rsvpUrl = new URL(page.url());
          expect(rsvpUrl.searchParams.get("token")).toBe(editToken);
          expect(rsvpUrl.searchParams.get("status")).toBe(status);
          await expect(page.getByText("RSVP as", { exact: true })).toBeVisible();
          await expect(page.getByPlaceholder("Your name (required)")).toHaveValue(guestName);
          await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute(
            "aria-pressed",
            "true"
          );
          // A first answer through an invitation link is an RSVP, not an update.
          await page.getByRole("button", { name: "Confirm RSVP", exact: true }).click();
          const heading = { GOING: "You're in!", MAYBE: "Noted!", NO: "Got it." }[status];
          await expect(page.getByText(heading, { exact: true })).toBeVisible();
          // No email or phone on this RSVP, so the copy-link fallback still shows (#754).
          await expect(page.getByText("⚠️ Save your Edit Link", { exact: true })).toBeVisible();

          const saved = await pool.query<{
            id: string;
            editToken: string;
            guestName: string;
            status: string;
            responded: boolean;
          }>(
            `SELECT id, "editToken", "guestName", status, responded FROM "RSVP" WHERE "eventId" = $1`,
            [eventId]
          );
          expect(saved.rows).toEqual([
            { id: rsvpId, editToken, guestName, status, responded: true },
          ]);
          expect((await context.cookies()).some((cookie) => cookie.name === "rsvp-session")).toBe(
            false
          );
        } finally {
          try {
            await pool.query(`DELETE FROM "Event" WHERE id = $1`, [eventId]);
          } finally {
            await pool.end();
          }
        }
      });
    }
  }
});
