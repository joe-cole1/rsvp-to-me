import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_HOST_EMAIL, readAuthCookies } from "./fixtures";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`preset defaults and viewport dialog at ${viewport.width}px`, async ({ page, context }) => {
    await context.addCookies(readAuthCookies());
    await page.setViewportSize(viewport);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const event = { id: randomUUID(), slug: `e2e-theme-defaults-${viewport.width}` };
    try {
      const host = (
        await pool.query<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [E2E_HOST_EMAIL])
      ).rows[0];
      await pool.query(
        `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt")
         VALUES ($1,$2,'Theme defaults','PUBLISHED','PUBLIC','2030-12-01T20:00:00Z','America/New_York','PHYSICAL',$3,now(),now())`,
        [event.id, event.slug, host.id]
      );
      await page.goto(`/e/${event.slug}/settings?section=theme`);
      for (const [name, presetId, fontId] of [
        ["Christmas", "winter-holidays", "lora"],
        ["New Year's Eve", "new-years", "playfair"],
        ["Valentine's Day", "valentines", "dancing-script"],
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        await expect
          .poll(async () => {
            const row = (
              await pool.query(
                'SELECT "appliedPresetId", "fontId" FROM "EventTheme" WHERE "eventId" = $1',
                [event.id]
              )
            ).rows[0];
            return row ?? null;
          })
          .toEqual({ appliedPresetId: presetId, fontId });
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Restore to/ })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /Restore to/ })).toHaveCount(0);
      }
      await page.getByRole("button", { name: "Font", exact: true }).click();
      await page.getByRole("button", { name: "Theme default", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await pool.query('SELECT "fontId" FROM "EventTheme" WHERE "eventId" = $1', [event.id]))
              .rows[0]?.fontId
        )
        .toBeNull();
      await page.getByRole("button", { name: "Theme", exact: true }).click();
      await page.getByRole("button", { name: "Christmas", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Replace customized settings?" });
      await expect(dialog).toBeVisible();
      const overlay = await dialog.locator("..").boundingBox();
      expect(overlay).not.toBeNull();
      expect(overlay!.x).toBeCloseTo(0, 0);
      expect(overlay!.y).toBeCloseTo(0, 0);
      expect(overlay!.width).toBeCloseTo(viewport.width, 0);
      expect(overlay!.height).toBeCloseTo(viewport.height, 0);
      const box = (await dialog.boundingBox())!;
      expect(box.x + box.width / 2).toBeCloseTo(viewport.width / 2, 0);
      expect(box.y + box.height / 2).toBeCloseTo(viewport.height / 2, 0);
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Christmas", exact: true })).toBeFocused();
    } finally {
      try {
        await pool.query('DELETE FROM "Event" WHERE id = $1', [event.id]);
      } finally {
        await pool.end();
      }
    }
  });
}
