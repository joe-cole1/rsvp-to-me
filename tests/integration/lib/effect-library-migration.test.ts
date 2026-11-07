import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// #825: run the real migration SQL against pre-migration EventTheme rows in a
// rollback-only schema. It must be purely additive: existing effect choices,
// amounts, speeds and sizes (including non-preset sizes and null) stay exactly
// as they were, icon lists start empty and movement stays null (inherit).
const client = new Client({ connectionString: process.env.DATABASE_URL });
const MIGRATION = "prisma/postgres-migrations/20261107180000_theme_effect_library/migration.sql";

beforeAll(async () => {
  await client.connect();
  await client.query("BEGIN");
  const schema = `effect_library_fixture_${randomUUID().replaceAll("-", "")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  // EventTheme as of 20260711202626_add_theme_effect_size
  await client.query(`
    CREATE TYPE "BaseTheme" AS ENUM ('DARK', 'SOFT', 'BOLD');
    CREATE TABLE "EventTheme" (
      id TEXT PRIMARY KEY,
      "eventId" TEXT NOT NULL UNIQUE,
      "baseTheme" "BaseTheme" NOT NULL DEFAULT 'DARK',
      "gradientFrom" TEXT NOT NULL DEFAULT '#7c3aed',
      "gradientTo" TEXT NOT NULL DEFAULT '#1e40af',
      "accentColor" TEXT NOT NULL DEFAULT '#a855f7',
      "coverImageUrl" TEXT,
      "appliedPresetId" TEXT,
      "cardOpacity" DOUBLE PRECISION,
      "fontId" TEXT,
      "effectId" TEXT,
      "effectDensity" TEXT,
      "effectSpeed" TEXT,
      "effectSize" DOUBLE PRECISION
    );
  `);
  await client.query(`
    INSERT INTO "EventTheme" (id, "eventId") VALUES ('none', 'e-none');
    INSERT INTO "EventTheme" (id, "eventId", "baseTheme", "gradientFrom", "gradientTo",
      "accentColor", "appliedPresetId", "cardOpacity", "fontId", "effectId", "effectDensity",
      "effectSpeed", "effectSize")
      VALUES ('legacy-6x', 'e-6x', 'BOLD', '#fde68a', '#fca5a5', '#be123c', 'preset-1', 0.6,
        'playfair', 'balloons', 'sparse', 'lively', 6);
    INSERT INTO "EventTheme" (id, "eventId", "effectId", "effectDensity", "effectSize")
      VALUES ('amount-more', 'e-more', 'snow', 'dense', 2);
    INSERT INTO "EventTheme" (id, "eventId", "effectId", "effectSize")
      VALUES ('null-size', 'e-null', 'confetti', NULL);
    INSERT INTO "EventTheme" (id, "eventId", "effectSize")
      VALUES ('inactive-sized', 'e-inactive', 4.5);
  `);
  await client.query(readFileSync(MIGRATION, "utf8"));
});

afterAll(async () => {
  await client.query("ROLLBACK");
  await client.end();
});

async function row(id: string) {
  const { rows } = await client.query('SELECT * FROM "EventTheme" WHERE id = $1', [id]);
  return rows[0];
}

describe("effect library migration", () => {
  it("adds an empty icon list and a null movement to every existing row", async () => {
    for (const id of ["none", "legacy-6x", "amount-more", "null-size", "inactive-sized"]) {
      expect(await row(id), id).toMatchObject({ effectIconIds: [], effectMovement: null });
    }
  });

  it("leaves every existing theme and effect value exactly as stored", async () => {
    expect(await row("legacy-6x")).toMatchObject({
      baseTheme: "BOLD",
      gradientFrom: "#fde68a",
      gradientTo: "#fca5a5",
      accentColor: "#be123c",
      appliedPresetId: "preset-1",
      cardOpacity: 0.6,
      fontId: "playfair",
      effectId: "balloons",
      effectDensity: "sparse",
      effectSpeed: "lively",
      effectSize: 6,
    });
    expect(await row("amount-more")).toMatchObject({
      effectId: "snow",
      effectDensity: "dense",
      effectSize: 2,
    });
    expect(await row("null-size")).toMatchObject({ effectId: "confetti", effectSize: null });
    expect(await row("inactive-sized")).toMatchObject({ effectId: null, effectSize: 4.5 });
    expect(await row("none")).toMatchObject({
      effectId: null,
      effectDensity: null,
      effectSpeed: null,
      effectSize: null,
    });
  });

  it("gives new rows the same defaults and stores a mixture", async () => {
    await client.query(`INSERT INTO "EventTheme" (id, "eventId") VALUES ('new', 'e-new')`);
    expect(await row("new")).toMatchObject({ effectIconIds: [], effectMovement: null });
    await client.query(
      `UPDATE "EventTheme" SET "effectId" = 'custom', "effectIconIds" = $1, "effectMovement" = 'random'
       WHERE id = 'new'`,
      [["noto:cat", "noto:red-heart"]]
    );
    expect(await row("new")).toMatchObject({
      effectId: "custom",
      effectIconIds: ["noto:cat", "noto:red-heart"],
      effectMovement: "random",
    });
  });
});
