import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_HOST_EMAIL, readAuthCookies } from "./fixtures";

// 01a1baab: presets whose default font was added after their snapshot was saved
// must apply without a false customization warning or Restore button, and the
// overwrite confirmation must cover and center in the viewport.
//
// The test creates its own presets (legacy snapshots that omit fontId and
// cardOpacity) instead of relying on seeded built-ins: CI applies migrations
// but never runs the seed, so built-in names and fonts differ there.

const LEGACY_PRESETS = [
  { key: "lora", base: "DARK", from: "#166534", to: "#0f172a", accent: "#fbbf24" },
  { key: "playfair", base: "DARK", from: "#1e1b4b", to: "#0f172a", accent: "#fbbf24" },
  { key: "dancing-script", base: "SOFT", from: "#fecdd3", to: "#fda4af", accent: "#e11d48" },
] as const;

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`preset defaults and viewport dialog at ${viewport.width}px`, async ({ page, context }) => {
    await context.addCookies(readAuthCookies());
    await page.setViewportSize(viewport);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const event = { id: randomUUID(), slug: `e2e-theme-defaults-${viewport.width}` };
    const presets = LEGACY_PRESETS.map((p) => ({
      ...p,
      id: `e2e-legacy-${p.key}-${viewport.width}`,
      name: `E2E ${p.key} ${viewport.width}`,
    }));
    try {
      for (const p of presets) {
        // A snapshot saved before fonts and card opacity existed: both keys omitted.
        const legacySnapshot = {
          name: p.name,
          emoji: "✨",
          base: p.base,
          gradientFrom: p.from,
          gradientTo: p.to,
          accentColor: p.accent,
          seasonal: false,
          month: null,
        };
        await pool.query(
          `INSERT INTO "ThemePreset" (id,name,emoji,base,"gradientFrom","gradientTo","accentColor","fontId",active,"sortOrder",presentation,"originalSnapshot","defaultSnapshot")
           VALUES ($1,$2,'✨',$3::"BaseTheme",$4,$5,$6,$7,true,0,$8::jsonb,$9::jsonb,$9::jsonb)`,
          [
            p.id,
            p.name,
            p.base,
            p.from,
            p.to,
            p.accent,
            p.key,
            JSON.stringify({ category: "general", tileIconId: "noto:sparkles", effect: null }),
            JSON.stringify(legacySnapshot),
          ]
        );
      }
      const host = (
        await pool.query<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [E2E_HOST_EMAIL])
      ).rows[0];
      await pool.query(
        `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt")
         VALUES ($1,$2,'Theme defaults','PUBLISHED','PUBLIC','2030-12-01T20:00:00Z','America/New_York','PHYSICAL',$3,now(),now())`,
        [event.id, event.slug, host.id]
      );
      await page.goto(`/e/${event.slug}/settings?section=theme`);
      for (const preset of presets) {
        await page.getByRole("button", { name: preset.name, exact: true }).click();
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
          .toEqual({ appliedPresetId: preset.id, fontId: preset.key });
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Restore to/ })).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("button", { name: preset.name, exact: true })).toBeVisible();
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
      const first = page.getByRole("button", { name: presets[0].name, exact: true });
      await first.click();
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
      await expect(first).toBeFocused();
    } finally {
      try {
        await pool.query('DELETE FROM "Event" WHERE id = $1', [event.id]);
        await pool.query('DELETE FROM "ThemePreset" WHERE id = ANY($1::text[])', [
          presets.map((p) => p.id),
        ]);
      } finally {
        await pool.end();
      }
    }
  });
}
