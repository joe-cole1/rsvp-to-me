/*
  Warnings:

  - You are about to drop the column `approvalNotifyEmail` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `approvalNotifySms` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `hostAlertEmail` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `hostAlertSms` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `rsvpConfirmEmail` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `rsvpConfirmSms` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `postEventPrompt` on the `EventReminderSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "approvalNotifyEmail",
DROP COLUMN "approvalNotifySms",
DROP COLUMN "hostAlertEmail",
DROP COLUMN "hostAlertSms",
DROP COLUMN "rsvpConfirmEmail",
DROP COLUMN "rsvpConfirmSms",
ADD COLUMN     "allowEditAfterDeadline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostDisplayName" TEXT;

-- AlterTable
ALTER TABLE "EventCoHost" ADD COLUMN     "displayName" TEXT;

-- AlterTable
ALTER TABLE "EventReminderSettings" DROP COLUMN "postEventPrompt";
