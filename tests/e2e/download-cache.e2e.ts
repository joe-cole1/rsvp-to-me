import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { E2E_HOST_EMAIL, PRIVATE_EVENT_SLUG, readAuthCookies } from "./fixtures";

test("01a197b1 download responses prevent storage and repeated browser CSV reads stay current", async ({
  page,
  context,
  request,
}) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const eventId = randomUUID();
  const rsvpId = randomUUID();
  const slug = `e2e-download-cache-${eventId}`;
  const missingSlug = `missing-${eventId}`;
  try {
    const host = await pool.query<{ id: string }>('SELECT id FROM "User" WHERE email=$1', [
      E2E_HOST_EMAIL,
    ]);
    await pool.query(
      `INSERT INTO "Event" (id,slug,title,status,visibility,"startAt",timezone,"locationType","hostId","createdAt","updatedAt") VALUES ($1,$2,'Download Cache Test','PUBLISHED','PUBLIC','2030-12-01T20:00:00Z','UTC','PHYSICAL',$3,now(),now())`,
      [eventId, slug, host.rows[0].id]
    );
    await pool.query(
      `INSERT INTO "RSVP" (id,"eventId","guestName",status,"editToken","updatedAt") VALUES ($1,$2,'Original guest','GOING',$3,now())`,
      [rsvpId, eventId, randomUUID()]
    );

    // Anonymous requests cover denial and missing-resource responses before host authentication.
    for (const [path, status] of [
      [`/e/${slug}/guests.csv`, 401],
      [`/e/${PRIVATE_EVENT_SLUG}/calendar.ics`, 404],
      [`/e/${missingSlug}/calendar.ics`, 404],
      [`/api/admin/backups/missing-${eventId}.sql.gz`, 403],
    ] as const) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(status);
      expect(response.headers()["cache-control"], path).toBe("private, no-store");
    }

    await context.addCookies(readAuthCookies());
    for (const path of [`/e/${slug}/guests.csv`, `/e/${slug}/calendar.ics`]) {
      const response = await context.request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toBe("private, no-store");
    }
    const missingCsv = await context.request.get(`/e/${missingSlug}/guests.csv`);
    expect(missingCsv.status()).toBe(403);
    expect(missingCsv.headers()["cache-control"]).toBe("private, no-store");

    await page.goto(`/e/${slug}/guests`);
    const csvPath = `/e/${slug}/guests.csv`;
    const download = () =>
      page.evaluate(async (path) => {
        const response = await fetch(path);
        return {
          status: response.status,
          cacheControl: response.headers.get("cache-control"),
          text: await response.text(),
        };
      }, csvPath);
    const first = await download();
    expect(first.status).toBe(200);
    expect(first.cacheControl).toBe("private, no-store");
    expect(first.text).toContain('"Original guest"');
    await pool.query(
      `UPDATE "RSVP" SET "guestName"='Updated guest',status='NO',"updatedAt"=now() WHERE id=$1`,
      [rsvpId]
    );
    const latest = await download();
    expect(latest.status).toBe(200);
    expect(latest.cacheControl).toBe("private, no-store");
    expect(latest.text).toContain('"Updated guest"');
    expect(latest.text).toContain('"NO"');
    expect(latest.text).not.toContain("Original guest");
  } finally {
    await pool.query('DELETE FROM "Event" WHERE id=$1', [eventId]);
    await pool.end();
  }
});
