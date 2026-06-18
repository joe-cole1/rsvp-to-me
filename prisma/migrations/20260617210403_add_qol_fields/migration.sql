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
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maybeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionnaireEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showTimestamps" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "hostId", "id", "locationAddress", "locationName", "locationType", "maybeEnabled", "password", "plusOneAllowed", "plusOneMax", "questionnaireEnabled", "rsvpDeadline", "showTimestamps", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility") SELECT "approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "hostId", "id", "locationAddress", "locationName", "locationType", "maybeEnabled", "password", "plusOneAllowed", "plusOneMax", "questionnaireEnabled", "rsvpDeadline", "showTimestamps", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE TABLE "new_PotluckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "claimedQty" INTEGER,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PotluckItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PotluckItem" ("claimedAt", "claimedBy", "createdAt", "eventId", "id", "label") SELECT "claimedAt", "claimedBy", "createdAt", "eventId", "id", "label" FROM "PotluckItem";
DROP TABLE "PotluckItem";
ALTER TABLE "new_PotluckItem" RENAME TO "PotluckItem";
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
    "responded" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RSVP" ("approved", "createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "note", "plusOneCount", "status", "updatedAt", "userId") SELECT "approved", "createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "note", "plusOneCount", "status", "updatedAt", "userId" FROM "RSVP";
DROP TABLE "RSVP";
ALTER TABLE "new_RSVP" RENAME TO "RSVP";
CREATE UNIQUE INDEX "RSVP_editToken_key" ON "RSVP"("editToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
