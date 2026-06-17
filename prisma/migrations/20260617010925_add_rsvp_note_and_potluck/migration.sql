-- AlterTable
ALTER TABLE "RSVP" ADD COLUMN "note" TEXT;

-- CreateTable
CREATE TABLE "PotluckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    CONSTRAINT "PotluckItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
