-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "hostAlertEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hostAlertSms" BOOLEAN NOT NULL DEFAULT false;
