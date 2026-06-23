-- Add DELETED status to EventStatus enum
ALTER TYPE "EventStatus" ADD VALUE 'DELETED';

-- Add deletion scheduling fields to User
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);
