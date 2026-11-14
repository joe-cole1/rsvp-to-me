-- Names are presentation, never proof of ownership. Preserve legacy rows
-- without guessing an RSVP from a display name.
ALTER TABLE "PotluckClaim" ADD COLUMN "rsvpId" TEXT, ADD COLUMN "userId" TEXT;
ALTER TABLE "PollVote" ADD COLUMN "rsvpId" TEXT;
DROP INDEX "PollVote_pollOptionId_voterName_key";
CREATE UNIQUE INDEX "PollVote_pollOptionId_rsvpId_key" ON "PollVote"("pollOptionId", "rsvpId");
-- Legacy account links are not ownership and can be duplicated under different names.
UPDATE "PollVote" SET "userId" = NULL;
CREATE UNIQUE INDEX "PollVote_pollOptionId_userId_key" ON "PollVote"("pollOptionId", "userId");
