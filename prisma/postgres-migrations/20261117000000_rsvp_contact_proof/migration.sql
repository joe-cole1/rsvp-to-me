-- Public RSVP contact proof is separate from account and notification verification.
CREATE TABLE "RsvpContactChallenge" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "receiptHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RsvpContactChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RsvpContactChallenge_contact_created_idx"
    ON "RsvpContactChallenge"("eventId", "channel", "destination", "createdAt");
CREATE INDEX "RsvpContactChallenge_expiresAt_idx" ON "RsvpContactChallenge"("expiresAt");
ALTER TABLE "RsvpContactChallenge" ADD CONSTRAINT "RsvpContactChallenge_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
