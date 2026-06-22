-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventTheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "baseTheme" TEXT NOT NULL DEFAULT 'DARK',
    "gradientFrom" TEXT NOT NULL DEFAULT '#7c3aed',
    "gradientTo" TEXT NOT NULL DEFAULT '#1e40af',
    "accentColor" TEXT NOT NULL DEFAULT '#a855f7',
    "coverImageUrl" TEXT,
    CONSTRAINT "EventTheme_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventTheme" ("accentColor", "baseTheme", "coverImageUrl", "eventId", "id") SELECT "accentColor", "baseTheme", "coverImageUrl", "eventId", "id" FROM "EventTheme";
DROP TABLE "EventTheme";
ALTER TABLE "new_EventTheme" RENAME TO "EventTheme";
CREATE UNIQUE INDEX "EventTheme_eventId_key" ON "EventTheme"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
