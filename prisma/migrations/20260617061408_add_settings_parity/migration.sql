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
    "maybeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "questionnaireEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showTimestamps" BOOLEAN NOT NULL DEFAULT true,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "hostId", "id", "locationAddress", "locationName", "locationType", "plusOneAllowed", "plusOneMax", "rsvpDeadline", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility") SELECT "approvalRequired", "capacity", "commentsEnabled", "createdAt", "description", "endAt", "guestListVis", "hostId", "id", "locationAddress", "locationName", "locationType", "plusOneAllowed", "plusOneMax", "rsvpDeadline", "slug", "startAt", "status", "timezone", "title", "updatedAt", "virtualUrl", "visibility" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
