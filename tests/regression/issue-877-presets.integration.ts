// #877: catalog defaults relied on startup seeding. Migrations must supply them
// on fresh databases and preserve administrator-owned values on upgrade.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, it } from "vitest";
import { THEME_PRESETS } from "@/lib/theme";
import { BUILTIN_PRESENTATIONS } from "@/lib/theme-preset-presentation";
it("installs missing production presets and preserves existing customizations", async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const schema = `preset_877_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE "ThemePreset" (LIKE public."ThemePreset" INCLUDING ALL)');
    const migration = readFileSync(
      "prisma/postgres-migrations/20261116100000_seed_free_presets/migration.sql",
      "utf8"
    );
    await client.query(migration);
    const rows = (await client.query('SELECT * FROM "ThemePreset"')).rows;
    expect(rows.map((r) => r.id).sort()).toEqual(THEME_PRESETS.map((p) => p.id).sort());
    for (const preset of THEME_PRESETS) {
      const row = rows.find((r) => r.id === preset.id);
      expect(row).toMatchObject({
        name: preset.name,
        fontId: preset.fontId ?? null,
        presentation: BUILTIN_PRESENTATIONS[preset.id],
      });
      expect(row.defaultSnapshot).toMatchObject({
        name: preset.name,
        presentation: BUILTIN_PRESENTATIONS[preset.id],
      });
      expect(row.originalSnapshot).toEqual(row.defaultSnapshot);
    }
    await client.query(
      `UPDATE "ThemePreset" SET name = 'Customized', active = false, "defaultSnapshot" = '{"name":"Mine"}' WHERE id = 'dark-night'`
    );
    await client.query(`DELETE FROM "ThemePreset" WHERE id <> 'dark-night'`);
    await client.query(migration);
    expect(
      (
        await client.query(
          `SELECT name,active,"defaultSnapshot" FROM "ThemePreset" WHERE id='dark-night'`
        )
      ).rows[0]
    ).toEqual({ name: "Customized", active: false, defaultSnapshot: { name: "Mine" } });
    expect(
      (await client.query('SELECT COUNT(*)::int AS count FROM "ThemePreset"')).rows[0].count
    ).toBe(THEME_PRESETS.length);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
