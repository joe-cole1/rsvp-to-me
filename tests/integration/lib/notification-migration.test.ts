import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Run the actual additive SQL against a populated legacy schema in a rollback-only
// PostgreSQL schema. db push alone cannot exercise data migration correctness.
const client = new Client({ connectionString: process.env.DATABASE_URL });
beforeAll(async () => {
  await client.connect();
  await client.query("BEGIN");
  const schema = `notification_fixture_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE "User" (id TEXT PRIMARY KEY, "notificationChannel" TEXT DEFAULT 'BOTH', "emailNotifications" BOOLEAN DEFAULT true, "smsNotifications" BOOLEAN DEFAULT true);
    CREATE TABLE "Event" (id TEXT PRIMARY KEY, "hostId" TEXT, "startAt" TIMESTAMP, "hostAlertEmail" BOOLEAN DEFAULT true, "hostAlertSms" BOOLEAN DEFAULT false);
    CREATE TABLE "RSVP" (id TEXT PRIMARY KEY, "eventId" TEXT, "userId" TEXT, "guestEmail" TEXT, "guestPhone" TEXT);
    CREATE TABLE "EventCoHost" ("eventId" TEXT, "userId" TEXT);
    CREATE TABLE "EventReminderSettings" ("eventId" TEXT, "emailWeekBefore" BOOLEAN DEFAULT false, "emailDayBefore" BOOLEAN DEFAULT false, "emailHoursBefore" INT DEFAULT 0, "smsWeekBefore" BOOLEAN DEFAULT false, "smsDayBefore" BOOLEAN DEFAULT false, "smsHoursBefore" INT DEFAULT 0, "nudgeUnresponded" BOOLEAN DEFAULT false);
    CREATE TABLE "SentReminder" ("eventId" TEXT, type TEXT);
  `);
  let index = 0;
  for (const channel of ["EMAIL", "SMS", "BOTH"])
    for (const email of [true, false])
      for (const sms of [true, false]) {
        await client.query('INSERT INTO "User" VALUES ($1,$2,$3,$4)', [
          `user${index}`,
          channel,
          email,
          sms,
        ]);
        await client.query('INSERT INTO "RSVP" VALUES ($1,$2,$3,$4,$5)', [
          `rsvp${index}`,
          "equal",
          `user${index}`,
          "guest@example.com",
          "+15550001111",
        ]);
        index++;
      }
  for (const event of ["equal", "distinct", "due"])
    await client.query(
      "INSERT INTO \"Event\" (id,\"hostId\",\"startAt\") VALUES ($1,$2,CASE WHEN $1 = 'due' THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes' ELSE TIMESTAMP '2099-01-01' END)",
      [event, "user0"]
    );
  // Alert switches both off, and an SMS-only event, are the cases the old snapshot mishandled.
  await client.query(
    `INSERT INTO "Event" (id,"hostId","startAt","hostAlertEmail","hostAlertSms") VALUES
      ('quiet','user2',TIMESTAMP '2099-01-01',false,false), ('textonly','user3',TIMESTAMP '2099-01-01',false,true)`
  );
  await client.query(`INSERT INTO "EventCoHost" VALUES ('equal','user1');
    INSERT INTO "EventReminderSettings" ("eventId","emailDayBefore","smsDayBefore","emailHoursBefore","smsHoursBefore") VALUES ('equal',true,true,0,0), ('distinct',false,false,2,4), ('due',true,false,0,0);
    INSERT INTO "SentReminder" VALUES ('equal','email_day');`);
  for (const name of [
    "20261103120000_notification_preferences",
    "20261103121000_event_notification_eligibility",
    "20261103122000_organizer_notification_bindings",
  ])
    await client.query(readFileSync(`prisma/postgres-migrations/${name}/migration.sql`, "utf8"));
});
afterAll(async () => {
  await client.query("ROLLBACK");
  await client.end();
});

describe("notification migration compatibility", () => {
  it("keeps the old scope of every legacy choice without enabling separate copies", async () => {
    // Old opt-outs covered reminders and host blasts; the channel choice covered updates;
    // confirmations were always sent. Profiles check every channel, never block, and
    // category rows carry the old update/reminder limits (an empty list turns one off).
    // No proof exists yet, so every migrated contact still gets one message.
    const { rows } = await client.query(
      'SELECT u.*, s.channels, s."blockedChannels" FROM "User" u JOIN "NotificationSettings" s ON s.id = \'profile:\' || u.id'
    );
    const { rows: categories } = await client.query(
      'SELECT "settingsId", category, channels FROM "NotificationCategoryPreference"'
    );
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      const order = ["email", "sms"];
      expect(row.channels).toEqual(order);
      expect(row.blockedChannels).toEqual([]);
      const allowed = (channel: string) =>
        channel === "email" ? row.emailNotifications : row.smsNotifications;
      const expected = Object.entries({
        updates: ["email", "sms"].filter(
          (channel) =>
            allowed(channel) && row.notificationChannel !== (channel === "email" ? "SMS" : "EMAIL")
        ),
        reminders: order.filter(allowed),
      })
        .filter(([, channels]) => JSON.stringify(channels) !== JSON.stringify(order))
        .map(([category, channels]) => ({ settingsId: `profile:${row.id}`, category, channels }));
      expect(
        categories
          .filter((item) => item.settingsId === `profile:${row.id}`)
          .sort((a, b) => a.category.localeCompare(b.category))
      ).toEqual(expected.sort((a, b) => a.category.localeCompare(b.category)));
    }
  });
  it("does not fabricate destination proof", async () => {
    for (const table of ["NotificationConnection", "NotificationBinding", "NotificationChallenge"])
      expect(
        (await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count
      ).toBe(0);
  });
  it("keeps RSVP contacts eligible without a preference-derived snapshot", async () => {
    // A snapshot built from opt-out flags would hide contacts that confirmations always used.
    expect(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM "NotificationSettings" WHERE "rsvpId" IS NOT NULL'
        )
      ).rows[0].count
    ).toBe(0);
  });
  it("merges equal timings and consumes both sides when either legacy marker exists", async () => {
    const { rows } = await client.query(
      'SELECT * FROM "NotificationSchedule" WHERE "eventId" = \'equal\''
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].hoursBefore).toBe(24);
    expect(rows[0].legacyChannels).toEqual(["email", "sms"]);
    expect(rows[0].recipientRouting).toBe(false);
    expect(rows[0].consumedAt).not.toBeNull();
  });
  it("preserves distinct custom hours and channel ceilings", async () => {
    const { rows } = await client.query(
      'SELECT * FROM "NotificationSchedule" WHERE "eventId" = \'distinct\' ORDER BY "hoursBefore"'
    );
    expect(rows.map((row) => [row.hoursBefore, row.legacyChannels, row.consumedAt])).toEqual([
      [2, ["email"], null],
      [4, ["sms"], null],
    ]);
  });
  it("suppresses upgrade catch-up for already due occurrences", async () => {
    expect(
      (
        await client.query(
          'SELECT "consumedAt" FROM "NotificationSchedule" WHERE "eventId" = \'due\''
        )
      ).rows[0].consumedAt
    ).not.toBeNull();
  });
  it("keeps each organizer's alert contacts from the event switches, ignoring blast opt-outs", async () => {
    // user1 opted out of SMS blasts; old host alerts ignored that, so eligibility is unchanged.
    const { rows } = await client.query(
      'SELECT "eventId", "userId", channels, "legacyChannels" FROM "NotificationSettings" WHERE "eventId" IN (\'equal\', \'textonly\') ORDER BY "eventId", "userId"'
    );
    expect(rows).toEqual([
      { eventId: "equal", userId: "user0", channels: [], legacyChannels: ["email"] },
      { eventId: "equal", userId: "user1", channels: [], legacyChannels: ["email"] },
      { eventId: "textonly", userId: "user3", channels: [], legacyChannels: ["sms"] },
    ]);
  });
  it("creates no organizer row for events whose alerts were off", async () => {
    // Root cause (01a1a105 QC): an empty migrated row overrode the event switches forever, so
    // turning alerts on after the upgrade sent nothing to existing organizers.
    expect(
      (
        await client.query(
          'SELECT count(*)::int AS count FROM "NotificationSettings" WHERE "eventId" = \'quiet\''
        )
      ).rows[0].count
    ).toBe(0);
  });
});
