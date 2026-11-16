// #880: exercise actual creation, URL edits, privacy decisions and retired routes.
// Optional screenshots are captured from these same working application flows.
import { test, expect, type Page } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { sealData } from "iron-session";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let hostId: string;
async function capture(page: Page, name: string) {
  if (!process.env.ISSUE_880_SCREENSHOTS) return;
  await mkdir(process.env.ISSUE_880_SCREENSHOTS, { recursive: true });
  await page.screenshot({
    path: path.join(process.env.ISSUE_880_SCREENSHOTS, `${name}.png`),
    animations: "disabled",
  });
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  hostId = randomUUID();
  const email = `url-${hostId}@example.test`;
  await pool.query(
    `INSERT INTO "User" (id,email,name,role,"createdAt") VALUES ($1,$2,'Preview Host','HOST',now())`,
    [hostId, email]
  );
  const session = randomUUID();
  await pool.query(
    `INSERT INTO "Session" (id,token,"userId","expiresAt","createdAt") VALUES ($1,$1,$2,now()+interval '1 day',now())`,
    [session, hostId]
  );
  const value = await sealData(
    { userId: hostId, email, role: "HOST", sessionId: session },
    { password: process.env.SESSION_SECRET!, ttl: 86400 }
  );
  await page.context().addCookies([
    {
      name: "rsvp-session",
      value,
      domain: new URL(test.info().project.use.baseURL!).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
});
test.afterEach(async () => {
  await pool.query('DELETE FROM "Event" WHERE "hostId"=$1', [hostId]);
  await pool.query('DELETE FROM "User" WHERE id=$1', [hostId]);
});
test.afterAll(async () => pool.end());

async function readableSlug(base: string) {
  let candidate = base;
  for (let suffix = 1; suffix < 100; suffix++) {
    if (!(await pool.query('SELECT id FROM "Event" WHERE slug=$1', [candidate])).rowCount)
      return candidate;
    candidate = `${base}-${suffix}`;
  }
  throw new Error("No fixture URL available");
}

async function seed(
  page: Page,
  mode: "PUBLIC" | "UNLISTED" | "PRIVATE",
  generated = mode !== "PUBLIC"
) {
  const id = randomUUID();
  const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const slug = generated ? code : await readableSlug("thanksgiving");
  await pool.query(
    `INSERT INTO "Event" (id,slug,"slugRandomCode",title,"hostId","startAt",status,visibility,"createdAt","updatedAt") VALUES ($1,$2,$3,'Thanksgiving',$4,'2099-11-26T18:00:00Z','PUBLISHED',$5,now(),now())`,
    [id, slug, generated ? code : null, hostId, mode]
  );
  await page.goto(`/e/${slug}/settings?section=privacy`);
  await expect(page.getByRole("textbox", { name: "Event URL" })).toHaveValue(slug);
  return { id, slug, code };
}
async function confirmChange(page: Page, slug: string) {
  const dialog = page.getByRole("dialog", { name: "Change event URL?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Change URL", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/e/${slug}/settings\\?section=privacy$`));
  await expect(page.getByRole("textbox", { name: "Event URL" })).toHaveValue(slug);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Event URL" })).toHaveValue(slug);
}

test("Public creation stays readable; Unlisted and Private get six-character codes", async ({
  page,
}) => {
  for (const mode of ["Public", "Unlisted", "Private"]) {
    await page.goto("/dashboard/events/new");
    await page.getByPlaceholder("Wine Night at Jane's").fill("Thanksgiving");
    await page.locator('input[name="startDate"]').fill("2099-11-26");
    await page.locator('input[name="startTime"]').fill("18:00");
    await page.getByRole("button", { name: /TBD/ }).click();
    await page.getByRole("radio", { name: new RegExp(mode) }).check();
    await page.getByRole("button", { name: /Create Event/ }).click();
    await expect(page).toHaveURL(/\/e\/[^/]+$/);
    const slug = new URL(page.url()).pathname.split("/").pop()!;
    expect(slug).toMatch(mode === "Public" ? /^thanksgiving(?:-\d+)?$/ : /^[A-Za-z0-9]{6}$/);
    await page.goto(`/e/${slug}/settings?section=privacy`);
    await expect(page.getByRole("textbox", { name: "Event URL" })).toHaveValue(slug);
    await capture(page, `01-default-${mode.toLowerCase()}`);
  }
});

test("a readable prefix retains the code and old event/invitation URLs stop resolving", async ({
  page,
  request,
}) => {
  const event = await seed(page, "UNLISTED");
  const slug = `thanksgiving-${event.code}`;
  await page.getByRole("textbox", { name: "Event URL" }).fill(slug);
  await capture(page, "02-prefix-preview");
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  await capture(page, "02-prefix-confirmation");
  await confirmChange(page, slug);
  await capture(page, "02-prefix-saved");
  expect((await request.get(`/e/${event.slug}`, { maxRedirects: 0 })).status()).toBe(404);
  expect(
    (
      await request.get(`/e/${event.slug}/rsvp?token=retired-test-token`, { maxRedirects: 0 })
    ).status()
  ).toBe(404);
  expect(
    (await pool.query('SELECT "slugRandomCode" FROM "Event" WHERE id=$1', [event.id])).rows[0]
      .slugRandomCode
  ).toBe(event.code);
});

test("Unlisted custom names require an explicit choice and cancellation keeps the old link", async ({
  page,
}) => {
  const event = await seed(page, "UNLISTED");
  const slug = await readableSlug("family-dinner");
  await page.getByRole("textbox", { name: "Event URL" }).fill(slug);
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  const warning = page.getByRole("dialog", { name: "This link may be easy to guess" });
  await expect(warning).toBeVisible();
  await capture(page, "03-unlisted-warning");
  await warning.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await pool.query('SELECT slug FROM "Event" WHERE id=$1', [event.id])).rows[0].slug).toBe(
    event.slug
  );
  await capture(page, "03-cancel-keeps-current-url");
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  await warning.getByRole("button", { name: "Use this URL", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Change event URL?" })).toBeVisible();
  await capture(page, "03-use-custom-confirmation");
  await confirmChange(page, slug);
  await capture(page, "03-custom-unlisted-saved");
  expect(
    (await pool.query('SELECT "slugRandomCode" FROM "Event" WHERE id=$1', [event.id])).rows[0]
      .slugRandomCode
  ).toBeNull();
});

test("the warning can re-add a random code before saving", async ({ page }) => {
  await seed(page, "UNLISTED");
  await page.getByRole("textbox", { name: "Event URL" }).fill("thanksgiving");
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add random code", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Change event URL?" })).toBeVisible();
  const slug = await page.getByRole("textbox", { name: "Event URL" }).inputValue();
  expect(slug).toMatch(/^thanksgiving-[A-Za-z0-9]{6}$/);
  await capture(page, "04-readded-code-preview");
  await confirmChange(page, slug);
  await capture(page, "04-readded-code-saved");
});

for (const mode of ["PUBLIC", "PRIVATE"] as const) {
  test(`${mode} custom names keep their access rules without a guessability warning`, async ({
    page,
    browser,
    baseURL,
  }) => {
    await seed(page, mode);
    const slug = await readableSlug(mode === "PUBLIC" ? "community-night" : "family-dinner");
    await page.getByRole("textbox", { name: "Event URL" }).fill(slug);
    await capture(page, `05-${mode.toLowerCase()}-custom-preview`);
    await page.getByRole("button", { name: "Save URL", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "This link may be easy to guess" })).toHaveCount(
      0
    );
    await confirmChange(page, slug);
    await capture(page, `05-${mode.toLowerCase()}-custom-saved`);
    if (mode === "PRIVATE") {
      const anonymous = await browser.newPage({ baseURL });
      await anonymous.goto(`/e/${slug}`);
      await expect(
        anonymous.getByRole("heading", { name: "Thanksgiving", exact: true })
      ).toHaveCount(0);
      await capture(anonymous, "05-private-anonymous-access");
      await anonymous.close();
    }
  });
}

test("visibility changes require consent before exposing a readable Unlisted link", async ({
  page,
}) => {
  const event = await seed(page, "PUBLIC");
  await page.getByRole("radio", { name: /Unlisted/ }).click();
  const warning = page.getByRole("dialog", { name: "This link may be easy to guess" });
  await expect(warning).toBeVisible();
  await expect(page.getByRole("radio", { name: /Public/ })).toBeChecked();
  await capture(page, "06-public-to-unlisted-warning");
  await warning.getByRole("button", { name: "Use this URL", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Unlisted/ })).toBeChecked();
  await capture(page, "06-unlisted-same-url");
  await page.getByRole("radio", { name: /Private/ }).click();
  await expect(page.getByRole("radio", { name: /Private/ })).toBeChecked();
  await capture(page, "06-private-same-url");
  await page.getByRole("radio", { name: /Unlisted/ }).click();
  await warning.getByRole("button", { name: "Add random code", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Change event URL?" })).toBeVisible();
  const slug = await page.getByRole("textbox", { name: "Event URL" }).inputValue();
  await capture(page, "06-private-to-unlisted-add-code");
  await confirmChange(page, slug);
  expect(
    (await pool.query('SELECT visibility FROM "Event" WHERE id=$1', [event.id])).rows[0].visibility
  ).toBe("UNLISTED");
});

test("a collision keeps the old link and a phone dialog fits the viewport", async ({ page }) => {
  const event = await seed(page, "PUBLIC");
  await seed(page, "PUBLIC");
  await page.getByRole("textbox", { name: "Event URL" }).fill(event.slug);
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Change URL", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already in use" })).toBeVisible();
  await capture(page, "07-address-already-taken");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Generate new link", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Event URL" })).not.toHaveValue(event.slug);
  await capture(page, "07-phone-generated-preview");
  await page.getByRole("button", { name: "Save URL", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Change event URL?" });
  await expect(dialog).toBeVisible();
  await capture(page, "07-phone-change-confirmation");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
