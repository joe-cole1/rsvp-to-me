-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "plusOneAllowed" SET DEFAULT false;

-- AlterTable
ALTER TABLE "EventReminderSettings" ALTER COLUMN "emailHoursBefore" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Poll" ALTER COLUMN "allowGuestsToAdd" SET DEFAULT false;
