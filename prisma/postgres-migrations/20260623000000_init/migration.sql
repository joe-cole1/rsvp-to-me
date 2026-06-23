-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GUEST', 'HOST', 'ADMIN');

-- CreateEnum
CREATE TYPE "MagicTokenType" AS ENUM ('LOGIN', 'EMAIL_CHANGE', 'PHONE_CHANGE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PHYSICAL', 'VIRTUAL', 'TBD');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'DELETED');

-- CreateEnum
CREATE TYPE "GuestListVis" AS ENUM ('ALL', 'GUESTS_ONLY', 'HOST_ONLY');

-- CreateEnum
CREATE TYPE "BaseTheme" AS ENUM ('DARK', 'SOFT', 'BOLD');

-- CreateEnum
CREATE TYPE "RSVPFieldType" AS ENUM ('TEXT', 'SELECT', 'CHECKBOX', 'TEXTAREA');

-- CreateEnum
CREATE TYPE "RSVPStatus" AS ENUM ('GOING', 'MAYBE', 'NO');

-- CreateEnum
CREATE TYPE "InviteChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionScheduledAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "type" "MagicTokenType" NOT NULL DEFAULT 'LOGIN',
    "metadata" TEXT,

    CONSTRAINT "MagicToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostInviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "locationType" "LocationType" NOT NULL DEFAULT 'PHYSICAL',
    "locationName" TEXT,
    "locationAddress" TEXT,
    "virtualUrl" TEXT,
    "capacity" INTEGER,
    "visibility" "Visibility" NOT NULL DEFAULT 'UNLISTED',
    "hostId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "rsvpDeadline" TIMESTAMP(3),
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "plusOneAllowed" BOOLEAN NOT NULL DEFAULT true,
    "plusOneMax" INTEGER NOT NULL DEFAULT 1,
    "plusOneNamesRequired" BOOLEAN NOT NULL DEFAULT false,
    "guestListVis" "GuestListVis" NOT NULL DEFAULT 'ALL',
    "guestSharingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "guestsCanInvite" BOOLEAN NOT NULL DEFAULT false,
    "rsvpConfirmEmail" BOOLEAN NOT NULL DEFAULT true,
    "rsvpConfirmSms" BOOLEAN NOT NULL DEFAULT true,
    "hostAlertEmail" BOOLEAN NOT NULL DEFAULT true,
    "hostAlertSms" BOOLEAN NOT NULL DEFAULT true,
    "approvalNotifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "approvalNotifySms" BOOLEAN NOT NULL DEFAULT true,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maybeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionnaireEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showTimestamps" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCoHost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EventCoHost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTheme" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "baseTheme" "BaseTheme" NOT NULL DEFAULT 'DARK',
    "accentColor" TEXT NOT NULL DEFAULT '#a855f7',
    "gradientFrom" TEXT NOT NULL DEFAULT '#7c3aed',
    "gradientTo" TEXT NOT NULL DEFAULT '#1e40af',
    "coverImageUrl" TEXT,

    CONSTRAINT "EventTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎨',
    "base" "BaseTheme" NOT NULL,
    "gradientFrom" TEXT NOT NULL,
    "gradientTo" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "month" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInfoSection" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventInfoSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReminderSettings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "emailWeekBefore" BOOLEAN NOT NULL DEFAULT false,
    "emailDayBefore" BOOLEAN NOT NULL DEFAULT true,
    "emailHoursBefore" INTEGER NOT NULL DEFAULT 2,
    "smsWeekBefore" BOOLEAN NOT NULL DEFAULT false,
    "smsDayBefore" BOOLEAN NOT NULL DEFAULT false,
    "smsHoursBefore" INTEGER NOT NULL DEFAULT 0,
    "nudgeUnresponded" BOOLEAN NOT NULL DEFAULT true,
    "postEventPrompt" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVPField" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "RSVPFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RSVPField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "status" "RSVPStatus" NOT NULL,
    "plusOneCount" INTEGER NOT NULL DEFAULT 0,
    "editToken" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "responded" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlusOneGuest" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlusOneGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVPAnswer" (
    "id" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "rsvpFieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "RSVPAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "channel" "InviteChannel" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rsvpId" TEXT,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventUpdate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "notifyGuests" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "rsvpId" TEXT,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotluckItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PotluckItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotluckClaim" (
    "id" TEXT NOT NULL,
    "potluckItemId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PotluckClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorName" TEXT,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "multiChoice" BOOLEAN NOT NULL DEFAULT false,
    "allowGuestsToAdd" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hideVoters" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "creatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "pollOptionId" TEXT NOT NULL,
    "voterName" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CronLock" (
    "jobName" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronLock_pkey" PRIMARY KEY ("jobName")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "MagicToken_token_key" ON "MagicToken"("token");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE UNIQUE INDEX "HostInviteCode_code_key" ON "HostInviteCode"("code");
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE UNIQUE INDEX "EventCoHost_eventId_userId_key" ON "EventCoHost"("eventId", "userId");
CREATE UNIQUE INDEX "EventTheme_eventId_key" ON "EventTheme"("eventId");
CREATE UNIQUE INDEX "EventReminderSettings_eventId_key" ON "EventReminderSettings"("eventId");
CREATE UNIQUE INDEX "RSVP_editToken_key" ON "RSVP"("editToken");
CREATE INDEX "PlusOneGuest_rsvpId_idx" ON "PlusOneGuest"("rsvpId");
CREATE UNIQUE INDEX "RSVPAnswer_rsvpId_rsvpFieldId_key" ON "RSVPAnswer"("rsvpId", "rsvpFieldId");
CREATE INDEX "PotluckClaim_potluckItemId_idx" ON "PotluckClaim"("potluckItemId");
CREATE UNIQUE INDEX "SentReminder_eventId_type_key" ON "SentReminder"("eventId", "type");
CREATE UNIQUE INDEX "CheckIn_rsvpId_key" ON "CheckIn"("rsvpId");
CREATE UNIQUE INDEX "PollVote_pollOptionId_voterName_key" ON "PollVote"("pollOptionId", "voterName");

-- AddForeignKey
ALTER TABLE "MagicToken" ADD CONSTRAINT "MagicToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventCoHost" ADD CONSTRAINT "EventCoHost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventCoHost" ADD CONSTRAINT "EventCoHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTheme" ADD CONSTRAINT "EventTheme_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventInfoSection" ADD CONSTRAINT "EventInfoSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventReminderSettings" ADD CONSTRAINT "EventReminderSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RSVPField" ADD CONSTRAINT "RSVPField_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlusOneGuest" ADD CONSTRAINT "PlusOneGuest_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RSVPAnswer" ADD CONSTRAINT "RSVPAnswer_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RSVPAnswer" ADD CONSTRAINT "RSVPAnswer_rsvpFieldId_fkey" FOREIGN KEY ("rsvpFieldId") REFERENCES "RSVPField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventUpdate" ADD CONSTRAINT "EventUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PotluckItem" ADD CONSTRAINT "PotluckItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PotluckClaim" ADD CONSTRAINT "PotluckClaim_potluckItemId_fkey" FOREIGN KEY ("potluckItemId") REFERENCES "PotluckItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SentReminder" ADD CONSTRAINT "SentReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollOptionId_fkey" FOREIGN KEY ("pollOptionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedData: default theme presets
INSERT INTO "ThemePreset" ("id","name","emoji","base","gradientFrom","gradientTo","accentColor","seasonal","active","sortOrder","month") VALUES
  ('dark-night',      'Dark Night',        '🌙', 'DARK'::"BaseTheme", '#7c3aed', '#1e40af', '#a855f7', false, true,  0, NULL),
  ('midnight-indigo', 'Midnight Indigo',   '✨', 'DARK'::"BaseTheme", '#312e81', '#1e1b4b', '#818cf8', false, true,  1, NULL),
  ('obsidian',        'Obsidian',          '🖤', 'DARK'::"BaseTheme", '#7c2d12', '#1c1917', '#f97316', false, true,  2, NULL),
  ('emerald-night',   'Emerald Night',     '🌿', 'DARK'::"BaseTheme", '#14532d', '#0f172a', '#22c55e', false, true,  3, NULL),
  ('rose-cloud',      'Rosé Cloud',        '🌸', 'SOFT'::"BaseTheme", '#fda4af', '#ddd6fe', '#e11d48', false, true,  4, NULL),
  ('peach-cream',     'Peach Cream',       '🍑', 'SOFT'::"BaseTheme", '#fde68a', '#fbcfe8', '#f59e0b', false, true,  5, NULL),
  ('garden-party',    'Garden Party',      '🌷', 'SOFT'::"BaseTheme", '#bbf7d0', '#a5f3fc', '#059669', false, true,  6, NULL),
  ('lavender-fields', 'Lavender Fields',   '💜', 'SOFT'::"BaseTheme", '#e9d5ff', '#ddd6fe', '#7c3aed', false, true,  7, NULL),
  ('sunset',          'Sunset',            '🌅', 'BOLD'::"BaseTheme", '#f97316', '#ec4899', '#f97316', false, true,  8, NULL),
  ('electric-blue',   'Electric Blue',     '⚡', 'BOLD'::"BaseTheme", '#0ea5e9', '#6366f1', '#0ea5e9', false, true,  9, NULL),
  ('deep-sea',        'Deep Sea',          '🌊', 'BOLD'::"BaseTheme", '#14b8a6', '#6366f1', '#0d9488', false, true, 10, NULL),
  ('valentines',      'Valentine''s Day',  '❤️', 'SOFT'::"BaseTheme", '#fecdd3', '#fda4af', '#e11d48', true,  true, 11,    2),
  ('st-patricks',     'St. Patrick''s Day','🍀', 'BOLD'::"BaseTheme", '#16a34a', '#15803d', '#ca8a04', true,  true, 12,    3),
  ('fourth-of-july',  '4th of July',       '🇺🇸','BOLD'::"BaseTheme", '#dc2626', '#1d4ed8', '#dc2626', true,  true, 13,    7),
  ('halloween',       'Halloween',         '🎃', 'DARK'::"BaseTheme", '#9a3412', '#1c1917', '#f97316', true,  true, 14,   10),
  ('thanksgiving',    'Thanksgiving',      '🦃', 'BOLD'::"BaseTheme", '#b45309', '#92400e', '#d97706', true,  true, 15,   11),
  ('winter-holidays', 'Winter Holidays',   '🎄', 'DARK'::"BaseTheme", '#166534', '#0f172a', '#fbbf24', true,  true, 16,   12),
  ('new-years',       'New Year''s Eve',   '🥂', 'DARK'::"BaseTheme", '#1e1b4b', '#0f172a', '#fbbf24', true,  true, 17,   12);
