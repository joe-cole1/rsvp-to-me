/*
  Warnings:

  - You are about to drop the column `bgColor` on the `EventTheme` table. All the data in the column will be lost.
  - You are about to drop the column `bgGradientFrom` on the `EventTheme` table. All the data in the column will be lost.
  - You are about to drop the column `bgGradientTo` on the `EventTheme` table. All the data in the column will be lost.
  - You are about to drop the column `bgStyle` on the `EventTheme` table. All the data in the column will be lost.
  - You are about to drop the column `patternName` on the `EventTheme` table. All the data in the column will be lost.
  - You are about to drop the column `textColor` on the `EventTheme` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "EventInfoSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EventInfoSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventReminderSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "emailWeekBefore" BOOLEAN NOT NULL DEFAULT false,
    "emailDayBefore" BOOLEAN NOT NULL DEFAULT true,
    "emailHoursBefore" INTEGER NOT NULL DEFAULT 2,
    "smsWeekBefore" BOOLEAN NOT NULL DEFAULT false,
    "smsDayBefore" BOOLEAN NOT NULL DEFAULT false,
    "smsHoursBefore" INTEGER NOT NULL DEFAULT 0,
    "nudgeUnresponded" BOOLEAN NOT NULL DEFAULT true,
    "postEventPrompt" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EventReminderSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "locationType" TEXT NOT NULL DEFAULT 'PHYSICAL',
    "locationName" TEXT,
    "locationAddress" TEXT,
    "virtualUrl" TEXT,
    "capacity" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'UNLISTED',
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rsvpDeadline" DATETIME,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "plusOneAllowed" BOOLEAN NOT NULL DEFAULT true,
    "plusOneMax" INTEGER NOT NULL DEFAULT 1,
    "guestListVis" TEXT NOT NULL DEFAULT 'ALL',
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("capacity", "createdAt", "description", "endAt", "hostId", "id", "locationAddress", "locationName", "locationType", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility") SELECT "capacity", "createdAt", "description", "endAt", "hostId", "id", "locationAddress", "locationName", "locationType", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE TABLE "new_EventTheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "baseTheme" TEXT NOT NULL DEFAULT 'DARK',
    "accentColor" TEXT NOT NULL DEFAULT '#a855f7',
    "coverImageUrl" TEXT,
    CONSTRAINT "EventTheme_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventTheme" ("accentColor", "coverImageUrl", "eventId", "id") SELECT "accentColor", "coverImageUrl", "eventId", "id" FROM "EventTheme";
DROP TABLE "EventTheme";
ALTER TABLE "new_EventTheme" RENAME TO "EventTheme";
CREATE UNIQUE INDEX "EventTheme_eventId_key" ON "EventTheme"("eventId");
CREATE TABLE "new_RSVP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "status" TEXT NOT NULL,
    "plusOneCount" INTEGER NOT NULL DEFAULT 0,
    "editToken" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RSVP" ("createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "plusOneCount", "status", "updatedAt") SELECT "createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "plusOneCount", "status", "updatedAt" FROM "RSVP";
DROP TABLE "RSVP";
ALTER TABLE "new_RSVP" RENAME TO "RSVP";
CREATE UNIQUE INDEX "RSVP_editToken_key" ON "RSVP"("editToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EventReminderSettings_eventId_key" ON "EventReminderSettings"("eventId");
