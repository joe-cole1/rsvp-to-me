-- Add PHONE, ADDRESS, and TERMS questionnaire field types, optional description, and Going-only filter (#786).
ALTER TYPE "RSVPFieldType" ADD VALUE 'PHONE';
ALTER TYPE "RSVPFieldType" ADD VALUE 'ADDRESS';
ALTER TYPE "RSVPFieldType" ADD VALUE 'TERMS';

ALTER TABLE "RSVPField"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "goingOnly" BOOLEAN NOT NULL DEFAULT false;
