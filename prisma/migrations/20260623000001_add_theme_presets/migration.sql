-- CreateTable
CREATE TABLE "ThemePreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎨',
    "base" TEXT NOT NULL,
    "gradientFrom" TEXT NOT NULL,
    "gradientTo" TEXT NOT NULL,
    "accentColor" TEXT NOT NULL,
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- SeedData: default theme presets
INSERT INTO "ThemePreset" ("id","name","emoji","base","gradientFrom","gradientTo","accentColor","seasonal","active","sortOrder") VALUES
  ('dark-night',      'Dark Night',        '🌙', 'DARK', '#7c3aed', '#1e40af', '#a855f7', 0, 1, 0),
  ('midnight-indigo', 'Midnight Indigo',   '✨', 'DARK', '#312e81', '#1e1b4b', '#818cf8', 0, 1, 1),
  ('obsidian',        'Obsidian',          '🖤', 'DARK', '#7c2d12', '#1c1917', '#f97316', 0, 1, 2),
  ('emerald-night',   'Emerald Night',     '🌿', 'DARK', '#14532d', '#0f172a', '#22c55e', 0, 1, 3),
  ('rose-cloud',      'Rosé Cloud',        '🌸', 'SOFT', '#fda4af', '#ddd6fe', '#e11d48', 0, 1, 4),
  ('peach-cream',     'Peach Cream',       '🍑', 'SOFT', '#fde68a', '#fbcfe8', '#f59e0b', 0, 1, 5),
  ('garden-party',    'Garden Party',      '🌷', 'SOFT', '#bbf7d0', '#a5f3fc', '#059669', 0, 1, 6),
  ('lavender-fields', 'Lavender Fields',   '💜', 'SOFT', '#e9d5ff', '#ddd6fe', '#7c3aed', 0, 1, 7),
  ('sunset',          'Sunset',            '🌅', 'BOLD', '#f97316', '#ec4899', '#f97316', 0, 1, 8),
  ('electric-blue',   'Electric Blue',     '⚡', 'BOLD', '#0ea5e9', '#6366f1', '#0ea5e9', 0, 1, 9),
  ('deep-sea',        'Deep Sea',          '🌊', 'BOLD', '#14b8a6', '#6366f1', '#0d9488', 0, 1, 10),
  ('valentines',      'Valentine''s Day',  '❤️', 'SOFT', '#fecdd3', '#fda4af', '#e11d48', 1, 1, 11),
  ('st-patricks',     'St. Patrick''s Day','🍀', 'BOLD', '#16a34a', '#15803d', '#ca8a04', 1, 1, 12),
  ('fourth-of-july',  '4th of July',       '🇺🇸','BOLD', '#dc2626', '#1d4ed8', '#dc2626', 1, 1, 13),
  ('halloween',       'Halloween',         '🎃', 'DARK', '#9a3412', '#1c1917', '#f97316', 1, 1, 14),
  ('thanksgiving',    'Thanksgiving',      '🦃', 'BOLD', '#b45309', '#92400e', '#d97706', 1, 1, 15),
  ('winter-holidays', 'Winter Holidays',   '🎄', 'DARK', '#166534', '#0f172a', '#fbbf24', 1, 1, 16),
  ('new-years',       'New Year''s Eve',   '🥂', 'DARK', '#1e1b4b', '#0f172a', '#fbbf24', 1, 1, 17);
