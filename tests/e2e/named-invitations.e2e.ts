import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_HOST_EMAIL, readAuthCookies } from "./fixtures";

for (const baseTheme of ["DARK", "SOFT"] as const) {
  test(`#749 ${baseTheme} named invitation review and guest rename preserve RSVP identity`, async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const eventId = randomUUID();
    const slug = `e2e-named-invitations-${eventId}`;
    const email = `issue749-${eventId}@test.internal`;
    const imported = `imported-${eventId}@test.internal`;
    try {
      const host = await pool.query<{ id: string }>('SELECT id FROM "User" WHERE email=$1', [
        E2E_HOST_EMAIL,
      ]);
      await pool.query(
        `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt") VALUES ($1,$2,'Named Invitations Test','PUBLISHED','PRIVATE','2030-12-01T20:00:00Z','UTC','PHYSICAL',$3,now(),now())`,
        [eventId, slug, host.rows[0].id]
      );
      await pool.query(
        `INSERT INTO "EventTheme" (id,"eventId","baseTheme") VALUES ($1,$2,$3::"BaseTheme")`,
        [randomUUID(), eventId, baseTheme]
      );
      await context.addCookies(readAuthCookies());
      await page.goto(`/e/${slug}`);
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("tab", { name: "Invite people" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      const firstName = page.getByRole("textbox", { name: "Name for recipient 1" });
      await expect(firstName).toBeFocused();
      await firstName.fill("Alice Smith");
      await firstName.press("Enter");
      await page.getByRole("textbox", { name: "Email or phone for recipient 1" }).fill(email);
      await page.getByRole("button", { name: "Import spreadsheet", exact: true }).click();
      await page.getByLabel("CSV file").setInputFiles({
        name: "guests.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(`First Name,Last Name,Email\nBen,Lee,${imported}\n`),
      });
      await expect(page.getByLabel("Email or phone from")).toHaveValue("2");
      await page.getByRole("button", { name: "Add 1 recipient", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Name for recipient 2" })).toHaveValue(
        "Ben Lee"
      );
      await page.screenshot({ path: testInfo.outputPath("invitation-add.png"), fullPage: true });
      await page.getByRole("button", { name: "Review 2 invitations", exact: true }).click();
      await expect(page.getByRole("checkbox", { name: new RegExp(email) })).toBeChecked();
      await expect(page.getByRole("checkbox", { name: new RegExp(imported) })).toBeChecked();
      await page.screenshot({
        path: testInfo.outputPath("invitation-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("invitation-mobile.png"), fullPage: true });
      await page.getByRole("button", { name: "Send 2 invitations", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("2 invitations sent.");
      const rows = await pool.query<{ id: string; editToken: string; guestName: string }>(
        `SELECT id,"editToken","guestName" FROM "RSVP" WHERE "eventId"=$1 AND "guestEmail"=$2`,
        [eventId, email]
      );
      expect(rows.rows).toHaveLength(1);
      const invited = rows.rows[0];
      expect(invited.guestName).toBe("Alice Smith");
      const guest = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
      try {
        const guestPage = await guest.newPage();
        await guestPage.goto(`/e/${slug}/rsvp?token=${invited.editToken}`);
        const name = guestPage.getByPlaceholder("Your name (required)");
        await expect(name).toHaveValue("Alice Smith");
        await name.fill("Alice Jones");
        await guestPage.getByRole("button", { name: "Confirm RSVP", exact: true }).click();
        await expect(guestPage.getByText("You're in!", { exact: true })).toBeVisible();
        // #754: the host supplied an email, so no "you didn't add an email" warning.
        await expect(guestPage.getByText(/Save your Edit Link/)).toHaveCount(0);
        await expect(
          guestPage.getByRole("link", { name: "Keep your private RSVP edit link" })
        ).toBeVisible();
        await expect(
          guestPage.getByRole("link", { name: "Keep your private RSVP edit link" })
        ).toHaveAttribute("href", `/e/${slug}/rsvp?token=${invited.editToken}`);
        await expect(
          guestPage.getByRole("link", { name: "Manage notifications for this event" })
        ).toHaveAttribute("href", `/e/${slug}/notifications?token=${invited.editToken}`);
        const updated = await pool.query<{
          id: string;
          editToken: string;
          guestName: string;
          responded: boolean;
        }>(
          `SELECT id,"editToken","guestName",responded FROM "RSVP" WHERE "eventId"=$1 AND "guestEmail"=$2`,
          [eventId, email]
        );
        expect(updated.rows).toEqual([
          {
            id: invited.id,
            editToken: invited.editToken,
            guestName: "Alice Jones",
            responded: true,
          },
        ]);
      } finally {
        await guest.close();
      }
      await page.goto(`/e/${slug}/guests`);
      await expect(page.getByText("Alice Jones", { exact: true }).first()).toBeVisible();
    } finally {
      await pool.query('DELETE FROM "Event" WHERE id=$1', [eventId]);
      await pool.query('DELETE FROM "User" WHERE email = ANY($1)', [[email, imported]]);
      await pool.end();
    }
  });
}
