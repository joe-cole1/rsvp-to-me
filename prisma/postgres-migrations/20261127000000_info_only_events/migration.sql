-- Info-only events without RSVPs (#843): event flag, anonymous comment token, and standalone questionnaires.
ALTER TABLE "Event" ADD COLUMN "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Comment" ADD COLUMN "voterTokenHash" TEXT;

CREATE TABLE "QuestionnaireSubmission" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "voterTokenHash" TEXT,
    "respondentName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionnaireAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rsvpFieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "QuestionnaireAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuestionnaireSubmission_eventId_idx" ON "QuestionnaireSubmission"("eventId");
CREATE UNIQUE INDEX "QuestionnaireSubmission_eventId_userId_key" ON "QuestionnaireSubmission"("eventId", "userId");
CREATE UNIQUE INDEX "QuestionnaireSubmission_eventId_voterTokenHash_key" ON "QuestionnaireSubmission"("eventId", "voterTokenHash");
CREATE UNIQUE INDEX "QuestionnaireAnswer_submissionId_rsvpFieldId_key" ON "QuestionnaireAnswer"("submissionId", "rsvpFieldId");

ALTER TABLE "QuestionnaireSubmission" ADD CONSTRAINT "QuestionnaireSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireAnswer" ADD CONSTRAINT "QuestionnaireAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "QuestionnaireSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionnaireAnswer" ADD CONSTRAINT "QuestionnaireAnswer_rsvpFieldId_fkey" FOREIGN KEY ("rsvpFieldId") REFERENCES "RSVPField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
