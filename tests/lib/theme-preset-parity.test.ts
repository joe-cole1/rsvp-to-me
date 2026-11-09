import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { THEME_PRESETS } from "@/lib/theme";
import { BUILTIN_PRESENTATIONS } from "@/lib/theme-preset-presentation";

// 01a1baab: the one-time migration carries a literal copy of the built-in
// preset metadata. These copies must never drift from lib/theme-preset-data.json,
// lib/theme.ts or the bundled Noto catalog.

const sql = readFileSync(
  "prisma/postgres-migrations/20261108130000_theme_preset_defaults/migration.sql",
  "utf8"
);
const catalog = JSON.parse(readFileSync("lib/effect-catalog-data/icons.json", "utf8")) as {
  icons: { id: string; src: string }[];
};
const known = new Map(catalog.icons.map((icon) => [icon.id, icon.src]));

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    );
  return value;
}
const same = (a: unknown, b: unknown) =>
  expect(JSON.stringify(sortKeys(a))).toBe(JSON.stringify(sortKeys(b)));

const sqlPresentation = new Map<string, unknown>();
for (const m of sql.matchAll(
  /UPDATE "ThemePreset" SET "presentation" = '(.*?)'::jsonb.*?WHERE "id" = '([a-z0-9-]+)';/g
))
  sqlPresentation.set(m[2], JSON.parse(m[1]));

const sqlBackfill = new Map<string, Record<string, unknown>>();
for (const m of sql.matchAll(
  /UPDATE "EventTheme" SET "effectId" = 'custom', "effectDensity" = '(\w+)', "effectSize" = (\d+), "effectSpeed" = '(\w+)', "effectMovement" = '(\w+)', "effectIconIds" = ARRAY\[(.*?)\]::text\[\] WHERE "appliedPresetId" = '([a-z0-9-]+)' AND "effectId" IS NULL;/g
))
  sqlBackfill.set(m[6], {
    effectId: "custom",
    effectDensity: m[1],
    effectSize: Number(m[2]),
    effectSpeed: m[3],
    effectMovement: m[4],
    effectIconIds: m[5].split(",").map((s) => s.replace(/'/g, "")),
  });

describe("built-in preset metadata parity", () => {
  it("covers exactly the built-in presets", () => {
    expect(Object.keys(BUILTIN_PRESENTATIONS).sort()).toEqual(
      THEME_PRESETS.map((p) => p.id).sort()
    );
    expect([...sqlPresentation.keys()].sort()).toEqual(THEME_PRESETS.map((p) => p.id).sort());
  });

  for (const preset of THEME_PRESETS) {
    it(`${preset.id}: migration, data, category and catalog agree`, () => {
      const data = BUILTIN_PRESENTATIONS[preset.id];
      same(sqlPresentation.get(preset.id), data);
      if (data.effect) same(sqlBackfill.get(preset.id), data.effect);
      else expect(sqlBackfill.has(preset.id)).toBe(false);
      expect(data.category === "seasonal").toBe(!!preset.seasonal);
      for (const id of [data.tileIconId, ...(data.effect?.effectIconIds ?? [])]) {
        expect(known.has(id), id).toBe(true);
        expect(existsSync(`public${known.get(id)}`), id).toBe(true);
      }
    });
  }

  it("inserts the new presets with their lib/theme.ts palettes", () => {
    const inserts = [
      ...sql.matchAll(
        /VALUES \('([a-z-]+)','[^']+','[^']+','(\w+)','(#[0-9a-f]+)','(#[0-9a-f]+)','(#[0-9a-f]+)'/g
      ),
    ];
    expect(inserts).toHaveLength(11);
    for (const [, id, base, from, to, accent] of inserts) {
      const preset = THEME_PRESETS.find((p) => p.id === id)!;
      expect({ base, from, to, accent }, id).toEqual({
        base: preset.base,
        from: preset.gradientFrom,
        to: preset.gradientTo,
        accent: preset.accentColor,
      });
    }
  });
});
