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
    "plusOneNamesRequired" BOOLEAN NOT NULL DEFAULT false,
    "guestListVis" TEXT NOT NULL DEFAULT 'ALL',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "guestSharingEnabled", "guestsCanInvite", "hostId", "id", "locationAddress", "locationName", "locationType", "maybeEnabled", "password", "plusOneAllowed", "plusOneMax", "plusOneNamesRequired", "questionnaireEnabled", "rsvpDeadline", "showTimestamps", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility") SELECT "approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "guestSharingEnabled", "guestsCanInvite", "hostId", "id", "locationAddress", "locationName", "locationType", "maybeEnabled", "password", "plusOneAllowed", "plusOneMax", "plusOneNamesRequired", "questionnaireEnabled", "rsvpDeadline", "showTimestamps", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
