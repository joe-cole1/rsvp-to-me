-- CreateTable
CREATE TABLE "ThemePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎨',
    "base" "BaseTheme" NOT NULL,
    "gradientFrom" TEXT NOT NULL,
    "gradientTo" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemePreset_pkey" PRIMARY KEY ("id")
);

-- SeedData: default theme presets
INSERT INTO "ThemePreset" ("id","name","emoji","base","gradientFrom","gradientTo","accentColor","seasonal","active","sortOrder") VALUES
  ('dark-night',      'Dark Night',        '🌙', 'DARK'::"BaseTheme", '#7c3aed', '#1e40af', '#a855f7', false, true, 0),
  ('midnight-indigo', 'Midnight Indigo',   '✨', 'DARK'::"BaseTheme", '#312e81', '#1e1b4b', '#818cf8', false, true, 1),
  ('obsidian',        'Obsidian',          '🖤', 'DARK'::"BaseTheme", '#7c2d12', '#1c1917', '#f97316', false, true, 2),
  ('emerald-night',   'Emerald Night',     '🌿', 'DARK'::"BaseTheme", '#14532d', '#0f172a', '#22c55e', false, true, 3),
  ('rose-cloud',      'Rosé Cloud',        '🌸', 'SOFT'::"BaseTheme", '#fda4af', '#ddd6fe', '#e11d48', false, true, 4),
  ('peach-cream',     'Peach Cream',       '🍑', 'SOFT'::"BaseTheme", '#fde68a', '#fbcfe8', '#f59e0b', false, true, 5),
  ('garden-party',    'Garden Party',      '🌷', 'SOFT'::"BaseTheme", '#bbf7d0', '#a5f3fc', '#059669', false, true, 6),
  ('lavender-fields', 'Lavender Fields',   '💜', 'SOFT'::"BaseTheme", '#e9d5ff', '#ddd6fe', '#7c3aed', false, true, 7),
  ('sunset',          'Sunset',            '🌅', 'BOLD'::"BaseTheme", '#f97316', '#ec4899', '#f97316', false, true, 8),
  ('electric-blue',   'Electric Blue',     '⚡', 'BOLD'::"BaseTheme", '#0ea5e9', '#6366f1', '#0ea5e9', false, true, 9),
  ('deep-sea',        'Deep Sea',          '🌊', 'BOLD'::"BaseTheme", '#14b8a6', '#6366f1', '#0d9488', false, true, 10),
  ('valentines',      'Valentine''s Day',  '❤️', 'SOFT'::"BaseTheme", '#fecdd3', '#fda4af', '#e11d48', true,  true, 11),
  ('st-patricks',     'St. Patrick''s Day','🍀', 'BOLD'::"BaseTheme", '#16a34a', '#15803d', '#ca8a04', true,  true, 12),
  ('fourth-of-july',  '4th of July',       '🇺🇸','BOLD'::"BaseTheme", '#dc2626', '#1d4ed8', '#dc2626', true,  true, 13),
  ('halloween',       'Halloween',         '🎃', 'DARK'::"BaseTheme", '#9a3412', '#1c1917', '#f97316', true,  true, 14),
  ('thanksgiving',    'Thanksgiving',      '🦃', 'BOLD'::"BaseTheme", '#b45309', '#92400e', '#d97706', true,  true, 15),
  ('winter-holidays', 'Winter Holidays',   '🎄', 'DARK'::"BaseTheme", '#166534', '#0f172a', '#fbbf24', true,  true, 16),
  ('new-years',       'New Year''s Eve',   '🥂', 'DARK'::"BaseTheme", '#1e1b4b', '#0f172a', '#fbbf24', true,  true, 17);
