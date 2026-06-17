-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RSVP" ("approved", "createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "note", "plusOneCount", "status", "updatedAt") SELECT "approved", "createdAt", "editToken", "eventId", "guestEmail", "guestName", "guestPhone", "id", "note", "plusOneCount", "status", "updatedAt" FROM "RSVP";
DROP TABLE "RSVP";
ALTER TABLE "new_RSVP" RENAME TO "RSVP";
CREATE UNIQUE INDEX "RSVP_editToken_key" ON "RSVP"("editToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
