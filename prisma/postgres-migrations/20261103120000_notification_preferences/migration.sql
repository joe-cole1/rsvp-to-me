-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "rsvpId" TEXT,
    "eventId" TEXT,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCategoryPreference" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "NotificationCategoryPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationBinding" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "connectionId" TEXT,
    "connectionGeneration" INTEGER,

    CONSTRAINT "NotificationBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "rsvpId" TEXT,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "originalDestination" TEXT,
    "secretHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSchedule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reminder',
    "hoursBefore" INTEGER NOT NULL,
    "legacyChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipientRouting" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "NotificationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_rsvpId_key" ON "NotificationSettings"("rsvpId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_eventId_key" ON "NotificationSettings"("userId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCategoryPreference_settingsId_category_key" ON "NotificationCategoryPreference"("settingsId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationConnection_userId_channel_key" ON "NotificationConnection"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationBinding_rsvpId_channel_key" ON "NotificationBinding"("rsvpId", "channel");

-- CreateIndex
CREATE INDEX "NotificationChallenge_expiresAt_idx" ON "NotificationChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSchedule_eventId_kind_hoursBefore_key" ON "NotificationSchedule"("eventId", "kind", "hoursBefore");

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCategoryPreference" ADD CONSTRAINT "NotificationCategoryPreference_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "NotificationSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationConnection" ADD CONSTRAINT "NotificationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationBinding" ADD CONSTRAINT "NotificationBinding_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationBinding" ADD CONSTRAINT "NotificationBinding_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "NotificationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChallenge" ADD CONSTRAINT "NotificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChallenge" ADD CONSTRAINT "NotificationChallenge_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSchedule" ADD CONSTRAINT "NotificationSchedule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Exactly one authorized settings scope; null eventId means profile defaults.
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_scope_check" CHECK (
  ("userId" IS NOT NULL AND "rsvpId" IS NULL) OR
  ("rsvpId" IS NOT NULL AND "userId" IS NULL AND "eventId" IS NULL)
);
CREATE UNIQUE INDEX "NotificationSettings_profile_unique" ON "NotificationSettings" ("userId") WHERE "eventId" IS NULL AND "userId" IS NOT NULL;
ALTER TABLE "NotificationChallenge" ADD CONSTRAINT "NotificationChallenge_scope_check" CHECK (("userId" IS NULL) <> ("rsvpId" IS NULL));
ALTER TABLE "NotificationSchedule" ADD CONSTRAINT "NotificationSchedule_hours_check" CHECK ("hoursBefore" > 0 AND "hoursBefore" <= 8760);

-- Legacy scope, preserved exactly: the Email/SMS opt-outs covered reminders and host blasts,
-- the channel choice covered event updates, and transactional messages were always sent.
-- Profile defaults therefore check every channel with no hard blocks, and category rows carry
-- the old update/reminder restrictions (an empty list turns that message off). No
-- connection/proof rows are fabricated, so every migrated contact is unproved and still gets
-- one message: email first, then text (the old Both order).
INSERT INTO "NotificationSettings" ("id", "userId", "channels")
SELECT 'profile:' || "id", "id", ARRAY['email','sms']
FROM "User";

INSERT INTO "NotificationCategoryPreference" ("id", "settingsId", "category", "channels")
SELECT 'legacy:' || u."id" || ':' || legacy.category, 'profile:' || u."id", legacy.category,
  legacy.channels
FROM "User" u CROSS JOIN LATERAL (VALUES
  -- Updates used only the chosen channel (Both: email and SMS), minus opt-outs.
  ('updates', array_remove(ARRAY[
    CASE WHEN u."notificationChannel"::text <> 'SMS' AND u."emailNotifications" THEN 'email' END,
    CASE WHEN u."notificationChannel"::text <> 'EMAIL' AND u."smsNotifications" THEN 'sms' END
  ], NULL)),
  -- Reminders used every channel not opted out.
  ('reminders', array_remove(ARRAY[
    CASE WHEN u."emailNotifications" THEN 'email' END,
    CASE WHEN u."smsNotifications" THEN 'sms' END
  ], NULL))
) legacy(category, channels)
WHERE legacy.channels IS DISTINCT FROM ARRAY['email','sms'];

-- Merge equal timings; retain source-channel ceilings until host review.
INSERT INTO "NotificationSchedule" ("id", "eventId", "kind", "hoursBefore", "legacyChannels", "recipientRouting", "consumedAt")
SELECT 'legacy:' || rs."eventId" || ':' || slot.kind || ':' || slot.hours,
 rs."eventId", slot.kind, slot.hours, array_agg(DISTINCT slot.channel ORDER BY slot.channel), false,
 CASE WHEN bool_or(EXISTS (SELECT 1 FROM "SentReminder" s WHERE s."eventId" = rs."eventId" AND s.type = slot.marker))
   OR e."startAt" - make_interval(hours => slot.hours) <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP END
FROM "EventReminderSettings" rs JOIN "Event" e ON e.id = rs."eventId"
CROSS JOIN LATERAL (VALUES
 ('reminder',168,'email',rs."emailWeekBefore",'email_week'),
 ('reminder',24,'email',rs."emailDayBefore",'email_day'),
 ('reminder',rs."emailHoursBefore",'email',rs."emailHoursBefore" > 0,'email_hours'),
 ('reminder',168,'sms',rs."smsWeekBefore",'sms_week'),
 ('reminder',24,'sms',rs."smsDayBefore",'sms_day'),
 ('reminder',rs."smsHoursBefore",'sms',rs."smsHoursBefore" > 0,'sms_hours'),
 ('nudge',72,'email',rs."nudgeUnresponded",'nudge_email'),
 ('nudge',72,'sms',rs."nudgeUnresponded",'nudge_sms')
) slot(kind,hours,channel,enabled,marker)
WHERE slot.enabled AND slot.hours > 0
GROUP BY rs."eventId", slot.kind, slot.hours, e."startAt";
