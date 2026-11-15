// #853 regression: document landmarks, keyboard bypass and standalone control targets.
import { test, expect } from "@playwright/test";
import { PUBLIC_EVENT_SLUG, readAuthCookies } from "./fixtures";

test("#853 public pages have one main and a keyboard skip link", async ({ page }) => {
  for (const path of [
    "/",
    "/auth/sign-in",
    `/e/${PUBLIC_EVENT_SLUG}`,
    `/e/${PUBLIC_EVENT_SLUG}/rsvp?status=GOING`,
    "/missing-issue-853",
  ]) {
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(main).toHaveCount(1);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(main).toBeFocused();
  }
  await page.goto(`/e/${PUBLIC_EVENT_SLUG}/rsvp?status=GOING`);
  await expect(page).toHaveTitle("RSVP · E2E Test Event | RSVP to Me");
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("textbox", { name: "Email or phone number" })).toHaveAttribute(
    "autocomplete",
    "username"
  );
});

test("#853 host routes retain one main and usable event controls on phones", async ({
  page,
  context,
}) => {
  await context.addCookies(readAuthCookies());
  for (const path of [
    "/dashboard",
    `/e/${PUBLIC_EVENT_SLUG}/settings`,
    `/e/${PUBLIC_EVENT_SLUG}/guests`,
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main").getByRole("main")).toHaveCount(0);
  }
  await page.goto(`/e/${PUBLIC_EVENT_SLUG}/settings`);
  await expect(page.locator("main h3")).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/e/${PUBLIC_EVENT_SLUG}`);
  for (const control of [
    page.getByRole("link", { name: "View all →", exact: true }),
    page.getByRole("link", { name: "RSVP settings", exact: true }),
  ]) {
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(24);
    expect(bounds!.width).toBeGreaterThanOrEqual(24);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: "/tmp/rsvp-01a1e09e-event-phone.png", fullPage: true });
});

test("#853 RSVP feedback works on DARK, SOFT and light-gradient BOLD themes", async ({ page }) => {
  const { Pool } = await import("pg");
  const { randomUUID } = await import("node:crypto");
  const { E2E_HOST_EMAIL } = await import("./fixtures");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const id = randomUUID();
  const slug = `e2e-853-themes-${id}`;
  try {
    const host = (await pool.query('SELECT id FROM "User" WHERE email = $1', [E2E_HOST_EMAIL]))
      .rows[0];
    await pool.query(
      `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt")
       VALUES ($1,$2,'Accessible RSVP','PUBLISHED','PUBLIC','2030-12-01T20:00:00Z','Asia/Seoul','TBD',$3,now(),now())`,
      [id, slug, host.id]
    );
    for (const base of ["DARK", "SOFT", "BOLD"]) {
      const preset = (
        await pool.query(
          `SELECT "gradientFrom", "gradientTo", "accentColor" FROM "ThemePreset"
         WHERE base = $1::"BaseTheme" AND ($1 <> 'BOLD' OR id = 'summer') ORDER BY id LIMIT 1`,
          [base]
        )
      ).rows[0];
      expect(preset).toBeTruthy();
      await pool.query(
        `INSERT INTO "EventTheme" (id,"eventId","baseTheme","gradientFrom","gradientTo","accentColor")
         VALUES ($1,$2,$3::"BaseTheme",$4,$5,$6) ON CONFLICT ("eventId") DO UPDATE
         SET "baseTheme" = EXCLUDED."baseTheme", "gradientFrom" = EXCLUDED."gradientFrom",
             "gradientTo" = EXCLUDED."gradientTo", "accentColor" = EXCLUDED."accentColor"`,
        [randomUUID(), id, base, preset.gradientFrom, preset.gradientTo, preset.accentColor]
      );
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/e/${slug}/rsvp?status=GOING`);
      await page.getByRole("button", { name: "Confirm RSVP" }).click();
      await expect(page.getByRole("textbox", { name: "Your name (required)" })).toBeFocused();
      await expect(page.getByRole("main").getByRole("alert")).toHaveText(
        "Check the highlighted fields."
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      await page.screenshot({ path: `/tmp/rsvp-01a1e09e-feedback-${base}.png`, fullPage: true });
    }
  } finally {
    await pool.query('DELETE FROM "Event" WHERE id = $1', [id]);
    await pool.end();
  }
});
