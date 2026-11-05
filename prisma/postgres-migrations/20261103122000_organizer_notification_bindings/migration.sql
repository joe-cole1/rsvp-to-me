ALTER TABLE "NotificationBinding" ALTER COLUMN "rsvpId" DROP NOT NULL;
ALTER TABLE "NotificationBinding" ADD COLUMN "settingsId" TEXT;
ALTER TABLE "NotificationBinding" ADD CONSTRAINT "NotificationBinding_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "NotificationSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "NotificationBinding_settingsId_channel_key" ON "NotificationBinding"("settingsId", "channel");
ALTER TABLE "NotificationBinding" ADD CONSTRAINT "NotificationBinding_scope_check" CHECK (("rsvpId" IS NULL) <> ("settingsId" IS NULL));

-- Organizers keep exactly the account contacts their event's alert switches covered; the
-- old alerts ignored blast/reminder opt-outs, so those flags do not apply here. Rows inherit
-- each organizer's profile route. Events whose alerts were off get no row, so turning
-- alerts on later follows the event's current switches instead of an empty snapshot.
INSERT INTO "NotificationSettings" ("id", "userId", "eventId", "legacyChannels")
SELECT 'organizer:' || e."id" || ':' || audience."userId", audience."userId", e."id",
  array_remove(ARRAY[CASE WHEN e."hostAlertEmail" THEN 'email' END, CASE WHEN e."hostAlertSms" THEN 'sms' END], NULL)
FROM "Event" e CROSS JOIN LATERAL (
  SELECT e."hostId" AS "userId" UNION SELECT "userId" FROM "EventCoHost" WHERE "eventId" = e."id"
) audience
WHERE e."hostAlertEmail" OR e."hostAlertSms";
