-- CreateTable
CREATE TABLE "PlusOneGuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rsvpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlusOneGuest_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlusOneGuest_rsvpId_idx" ON "PlusOneGuest"("rsvpId");
