import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { sealData } from "iron-session";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let hostId: string, eventId: string, slug: string, rsvpId: string, editToken: string;
test.beforeEach(async () => {
  hostId = randomUUID();
  eventId = randomUUID();
  slug = `e2e-notification-${randomUUID()}`;
  rsvpId = randomUUID();
  editToken = randomUUID();
  await pool.query(
    `INSERT INTO "User" (id,email,name,role,"createdAt") VALUES ($1,$2,'Notification Test Host','HOST',now())`,
    [hostId, `e2e-notification-${hostId}@test.internal`]
  );
  await pool.query(
    `INSERT INTO "Event" (id,slug,title,"hostId","startAt",status,visibility,"createdAt","updatedAt") VALUES ($1,$2,'Notification Test Event',$3,'2099-01-01','PUBLISHED','PRIVATE',now(),now())`,
    [eventId, slug, hostId]
  );
  await pool.query(
    `INSERT INTO "RSVP" (id,"eventId","guestName","guestEmail",status,"editToken","createdAt","updatedAt") VALUES ($1,$2,'Notification Test Guest','guest@example.com','GOING',$3,now(),now())`,
    [rsvpId, eventId, editToken]
  );
});
test.afterEach(async () => {
  await pool.query('DELETE FROM "Event" WHERE id=$1', [eventId]);
  await pool.query('DELETE FROM "User" WHERE id=$1', [hostId]);
});
test.afterAll(async () => pool.end());
async function signIn(page: Page) {
  const session = randomUUID();
  await pool.query(
    'INSERT INTO "Session" (id,token,"userId","expiresAt","createdAt") VALUES ($1,$1,$2,now()+interval \'1 day\',now())',
    [session, hostId]
  );
  const cookie = await sealData(
    {
      userId: hostId,
      email: `e2e-notification-${hostId}@test.internal`,
      role: "HOST",
      sessionId: session,
    },
    { password: process.env.SESSION_SECRET!, ttl: 86400 }
  );
  await page.context().addCookies([
    {
      name: "rsvp-session",
      value: cookie,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}
const settingsCount = async (column: "rsvpId" | "userId", value: string) =>
  (
    await pool.query(
      `SELECT count(*)::int AS count FROM "NotificationSettings" WHERE "${column}"=$1`,
      [value]
    )
  ).rows[0].count;
test("unsigned guest sees the page without channels it cannot use", async ({ page }) => {
  await page.goto(`/e/${slug}/notifications?token=${editToken}`);
  await expect(
    page.getByRole("heading", { name: "Notifications for Notification Test Event" })
  ).toBeVisible();
  // The E2E server configures no email or SMS provider, so nothing can be checked, and a
  // guest without an account has no profile to follow. Saving is covered by integration tests.
  await expect(page.getByText("This site doesn’t send notifications right now.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Save/ })).toHaveCount(0);
  expect(await settingsCount("rsvpId", rsvpId)).toBe(0);
});
test("private management rejects public IDs and wrong tokens and carries private headers", async ({
  page,
  request,
}) => {
  const valid = await request.get(`/e/${slug}/notifications?token=${editToken}`);
  expect(valid.status()).toBe(200);
  expect(valid.headers()["cache-control"]).toContain("no-store");
  expect(valid.headers()["referrer-policy"]).toBe("no-referrer");
  const bad = await request.get(`/e/${slug}/notifications?rsvpId=${rsvpId}`);
  expect(bad.status()).toBe(404);
  await page.goto(`/e/${slug}/notifications?token=${randomUUID()}`);
  await expect(
    page.getByRole("heading", { name: "Notifications for Notification Test Event" })
  ).toHaveCount(0);
});
test("profile hides channels the site does not offer and points to events", async ({ page }) => {
  await signIn(page);
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  // The E2E server configures no email or SMS provider, so no channel is offered or listed.
  await expect(page.getByText("This site doesn’t send notifications right now.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Contact info", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);
  // Single-event settings are a pointer, not an embedded picker.
  await expect(page.getByRole("heading", { name: "Settings for one event" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Choose an event" })).toHaveCount(0);
  // Viewing never writes settings.
  expect(await settingsCount("userId", hostId)).toBe(0);
});
test("shared reminder schedule labels and retains consumed state across switches", async ({
  page,
}) => {
  const slot = randomUUID();
  await pool.query(
    'INSERT INTO "NotificationSchedule" (id,"eventId","hoursBefore","consumedAt") VALUES ($1,$2,24,now())',
    [slot, eventId]
  );
  const read = async () =>
    (
      await pool.query(
        'SELECT enabled,"consumedAt","recipientRouting" FROM "NotificationSchedule" WHERE id=$1',
        [slot]
      )
    ).rows[0];
  await signIn(page);
  await page.goto(`/e/${slug}/settings?section=reminders`);
  await expect(page.getByRole("heading", { name: "Auto-Reminders", exact: true })).toBeVisible();
  const day = page.getByRole("switch", { name: "1 day before · already sent or skipped" });
  await day.click();
  await expect.poll(async () => (await read()).enabled).toBe(false);
  await day.click();
  await expect.poll(async () => (await read()).enabled).toBe(true);
  const row = await read();
  expect(row.recipientRouting).toBe(true);
  expect(row.consumedAt).not.toBeNull();
});
