-- AlterTable: Add soft-deletion fields to User
ALTER TABLE "User" ADD COLUMN "deletionRequestedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "deletionScheduledAt" DATETIME;
