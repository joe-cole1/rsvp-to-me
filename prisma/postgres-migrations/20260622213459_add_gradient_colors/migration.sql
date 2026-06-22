-- Replace secondaryColor/themePresetId with gradientFrom/gradientTo
ALTER TABLE "EventTheme"
  ADD COLUMN "gradientFrom" TEXT NOT NULL DEFAULT '#7c3aed',
  ADD COLUMN "gradientTo"   TEXT NOT NULL DEFAULT '#1e40af';

ALTER TABLE "EventTheme"
  DROP COLUMN IF EXISTS "secondaryColor",
  DROP COLUMN IF EXISTS "themePresetId";
