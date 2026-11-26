-- Per-poll RSVP requirement and anonymous browser voter token identity.
ALTER TABLE "Poll" ADD COLUMN "requireRsvp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PollVote" ADD COLUMN "voterTokenHash" TEXT;
CREATE UNIQUE INDEX "PollVote_pollOptionId_voterTokenHash_key" ON "PollVote"("pollOptionId", "voterTokenHash");
