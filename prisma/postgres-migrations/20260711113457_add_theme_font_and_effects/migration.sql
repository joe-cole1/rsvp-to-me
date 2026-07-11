-- AlterTable
ALTER TABLE "EventTheme" ADD COLUMN     "effectDensity" TEXT,
ADD COLUMN     "effectId" TEXT,
ADD COLUMN     "effectSpeed" TEXT,
ADD COLUMN     "fontId" TEXT;

-- AlterTable
ALTER TABLE "ThemePreset" ADD COLUMN     "fontId" TEXT;
