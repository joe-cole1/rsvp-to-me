import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, afterAll, it, expect } from "vitest";
const client = new Client({ connectionString: process.env.DATABASE_URL });
beforeAll(async () => {
  await client.connect();
  await client.query("BEGIN");
  const schema = `preset_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`
 CREATE TABLE "ThemePreset" (id text PRIMARY KEY, name text, emoji text, base text, "gradientFrom" text, "gradientTo" text, "accentColor" text, "sortOrder" int, "originalSnapshot" jsonb, "defaultSnapshot" jsonb);
 CREATE TABLE "EventTheme" (id text PRIMARY KEY, "appliedPresetId" text, "gradientFrom" text, "effectId" text, "effectIconIds" text[] DEFAULT '{}', "effectDensity" text, "effectSpeed" text, "effectSize" double precision, "effectMovement" text);
 INSERT INTO "ThemePreset" (id, "defaultSnapshot", "originalSnapshot") VALUES ('st-patricks','{"base":"BOLD"}','{"base":"BOLD"}');
 INSERT INTO "EventTheme" (id, "appliedPresetId", "gradientFrom", "effectId", "effectIconIds", "effectSize") VALUES
 ('empty','st-patricks','#abcdef',NULL,'{}',NULL),
 ('active','st-patricks','#123456','custom','{noto:cat}',6),
 ('unlinked',NULL,'#987654',NULL,'{}',NULL);
 `);
  await client.query(
    readFileSync(
      "prisma/postgres-migrations/20261108130000_theme_preset_defaults/migration.sql",
      "utf8"
    )
  );
});
afterAll(async () => {
  await client.query("ROLLBACK");
  await client.end();
});
it("fills only linked empty effects and preserves theme customization and active effects", async () => {
  const rows = (await client.query('SELECT * FROM "EventTheme" ORDER BY id')).rows;
  expect(rows.find((r) => r.id === "empty")).toMatchObject({
    gradientFrom: "#abcdef",
    effectId: "custom",
    effectIconIds: ["noto:shamrock", "noto:four-leaf-clover"],
    effectSize: 3,
    effectMovement: "random",
  });
  expect(rows.find((r) => r.id === "active")).toMatchObject({
    gradientFrom: "#123456",
    effectIconIds: ["noto:cat"],
    effectSize: 6,
  });
  expect(rows.find((r) => r.id === "unlinked").effectId).toBeNull();
});

it("adds the occasion metadata and includes effects in restore snapshots", async () => {
  const wedding = (await client.query("SELECT * FROM \"ThemePreset\" WHERE id = 'wedding'"))
    .rows[0];
  expect(wedding.presentation.category).toBe("occasion");
  expect(wedding.defaultSnapshot.presentation.effect.effectIconIds).toContain("noto:ring");
});
