import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// #811: run the real migration SQL against pre-migration Event rows in a
// rollback-only schema. Invited must arrive hidden, and rows whose names were
// hidden must keep their count hidden now that counts no longer follow names.
const client = new Client({ connectionString: process.env.DATABASE_URL });
const MIGRATION = "prisma/postgres-migrations/20261107120000_guest_invited_display/migration.sql";

beforeAll(async () => {
  await client.connect();
  await client.query("BEGIN");
  const schema = `guest_invited_fixture_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
    CREATE TYPE "GuestListDisplay" AS ENUM ('EXPANDED', 'COLLAPSED', 'HIDDEN');
    CREATE TYPE "GuestCountDisplay" AS ENUM ('EXACT', 'CAPPED', 'HIDDEN');
    CREATE TABLE "Event" (
      id TEXT PRIMARY KEY,
      "guestGoingList" "GuestListDisplay" NOT NULL DEFAULT 'EXPANDED',
      "guestGoingCount" "GuestCountDisplay" NOT NULL DEFAULT 'EXACT',
      "guestMaybeList" "GuestListDisplay" NOT NULL DEFAULT 'EXPANDED',
      "guestMaybeCount" "GuestCountDisplay" NOT NULL DEFAULT 'EXACT',
      "guestDeclinedList" "GuestListDisplay" NOT NULL DEFAULT 'COLLAPSED',
      "guestDeclinedCount" "GuestCountDisplay" NOT NULL DEFAULT 'HIDDEN'
    );
  `);
  await client.query(`
    INSERT INTO "Event" (id) VALUES ('defaults');
    INSERT INTO "Event" (id, "guestGoingList", "guestGoingCount", "guestMaybeList", "guestMaybeCount",
      "guestDeclinedList", "guestDeclinedCount")
      VALUES ('hidden-names', 'HIDDEN', 'EXACT', 'HIDDEN', 'EXACT', 'HIDDEN', 'CAPPED');
    INSERT INTO "Event" (id, "guestDeclinedList", "guestDeclinedCount")
      VALUES ('shown-capped', 'EXPANDED', 'CAPPED');
  `);
  // The file wraps itself in BEGIN/COMMIT; run its statements inside our rollback.
  const sql = readFileSync(MIGRATION, "utf8").replace(/^\s*(BEGIN|COMMIT);\s*$/gm, "");
  await client.query(sql);
});

afterAll(async () => {
  await client.query("ROLLBACK");
  await client.end();
});

async function row(id: string) {
  const { rows } = await client.query('SELECT * FROM "Event" WHERE id = $1', [id]);
  return rows[0];
}

describe("guest invited display migration", () => {
  it("adds Invited hidden for existing and new events", async () => {
    expect(await row("defaults")).toMatchObject({
      guestInvitedList: "HIDDEN",
      guestInvitedCount: "HIDDEN",
    });
    await client.query(`INSERT INTO "Event" (id) VALUES ('new-event')`);
    expect(await row("new-event")).toMatchObject({
      guestInvitedList: "HIDDEN",
      guestInvitedCount: "HIDDEN",
    });
  });

  it("hides the stored count wherever names were hidden", async () => {
    expect(await row("hidden-names")).toMatchObject({
      guestGoingCount: "HIDDEN",
      guestMaybeCount: "HIDDEN",
      guestDeclinedCount: "HIDDEN",
    });
  });

  it("leaves counts alone wherever names were shown", async () => {
    expect(await row("defaults")).toMatchObject({
      guestGoingCount: "EXACT",
      guestMaybeCount: "EXACT",
      guestDeclinedCount: "HIDDEN",
    });
    expect(await row("shown-capped")).toMatchObject({ guestDeclinedCount: "CAPPED" });
  });
});
