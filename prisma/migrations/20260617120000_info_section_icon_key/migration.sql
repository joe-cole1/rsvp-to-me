-- Convert InfoSectionType enum to a free-form String (icon key).
-- In SQLite, Prisma enums are stored as TEXT, so no column type change
-- is needed. This migration rebuilds the table purely to remove the
-- enum constraint from Prisma's schema tracking.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_EventInfoSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EventInfoSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_EventInfoSection" SELECT * FROM "EventInfoSection";

DROP TABLE "EventInfoSection";

ALTER TABLE "new_EventInfoSection" RENAME TO "EventInfoSection";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
