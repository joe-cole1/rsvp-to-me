-- AlterTable
ALTER TABLE "EventTheme" ADD COLUMN "secondaryColor" TEXT;
ALTER TABLE "EventTheme" ADD COLUMN "themePresetId" TEXT DEFAULT 'custom';
