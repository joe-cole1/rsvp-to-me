-- ThemePreset: add immutable original + admin-promotable default snapshot columns
ALTER TABLE "ThemePreset"
  ADD COLUMN "originalSnapshot" JSONB,
  ADD COLUMN "defaultSnapshot"  JSONB;

-- Backfill all existing presets: current live values become both snapshots
UPDATE "ThemePreset"
SET
  "originalSnapshot" = jsonb_build_object(
    'name',         "name",
    'emoji',        "emoji",
    'base',         "base"::text,
    'gradientFrom', "gradientFrom",
    'gradientTo',   "gradientTo",
    'accentColor',  "accentColor",
    'seasonal',     "seasonal",
    'month',        "month"
  ),
  "defaultSnapshot" = jsonb_build_object(
    'name',         "name",
    'emoji',        "emoji",
    'base',         "base"::text,
    'gradientFrom', "gradientFrom",
    'gradientTo',   "gradientTo",
    'accentColor',  "accentColor",
    'seasonal',     "seasonal",
    'month',        "month"
  )
WHERE "originalSnapshot" IS NULL;

-- EventTheme: track which preset was last applied by the host
ALTER TABLE "EventTheme" ADD COLUMN "appliedPresetId" TEXT;
