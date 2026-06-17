-- DropIndex
DROP INDEX "ActivityEvent_eventId_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventInfoSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EventInfoSection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventInfoSection" ("content", "eventId", "id", "order", "title", "type", "url") SELECT "content", "eventId", "id", "order", "title", "type", "url" FROM "EventInfoSection";
DROP TABLE "EventInfoSection";
ALTER TABLE "new_EventInfoSection" RENAME TO "EventInfoSection";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
