-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'BOTH');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notificationChannel" "NotificationChannel" NOT NULL DEFAULT 'BOTH';
