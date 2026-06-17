-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PotluckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "claimedBy" TEXT,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PotluckItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PotluckItem" ("claimedAt", "claimedBy", "eventId", "id", "label") SELECT "claimedAt", "claimedBy", "eventId", "id", "label" FROM "PotluckItem";
DROP TABLE "PotluckItem";
ALTER TABLE "new_PotluckItem" RENAME TO "PotluckItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
