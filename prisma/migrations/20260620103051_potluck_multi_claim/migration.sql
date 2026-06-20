/*
  Warnings:

  - You are about to drop the column `claimedAt` on the `PotluckItem` table. All the data in the column will be lost.
  - You are about to drop the column `claimedBy` on the `PotluckItem` table. All the data in the column will be lost.
  - You are about to drop the column `claimedQty` on the `PotluckItem` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "PotluckClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "potluckItemId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PotluckClaim_potluckItemId_fkey" FOREIGN KEY ("potluckItemId") REFERENCES "PotluckItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PotluckItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PotluckItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PotluckItem" ("createdAt", "eventId", "id", "label", "quantity") SELECT "createdAt", "eventId", "id", "label", "quantity" FROM "PotluckItem";
DROP TABLE "PotluckItem";
ALTER TABLE "new_PotluckItem" RENAME TO "PotluckItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PotluckClaim_potluckItemId_idx" ON "PotluckClaim"("potluckItemId");
