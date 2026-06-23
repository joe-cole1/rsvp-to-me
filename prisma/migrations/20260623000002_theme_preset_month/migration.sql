-- AlterTable
ALTER TABLE "ThemePreset" ADD COLUMN "month" INTEGER;

-- Update existing seasonal presets with their months
UPDATE "ThemePreset" SET "month" = 2  WHERE "id" = 'valentines';
UPDATE "ThemePreset" SET "month" = 3  WHERE "id" = 'st-patricks';
UPDATE "ThemePreset" SET "month" = 7  WHERE "id" = 'fourth-of-july';
UPDATE "ThemePreset" SET "month" = 10 WHERE "id" = 'halloween';
UPDATE "ThemePreset" SET "month" = 11 WHERE "id" = 'thanksgiving';
UPDATE "ThemePreset" SET "month" = 12 WHERE "id" = 'winter-holidays';
UPDATE "ThemePreset" SET "month" = 12 WHERE "id" = 'new-years';
