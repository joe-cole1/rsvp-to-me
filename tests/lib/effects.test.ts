import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  EFFECT_SETS,
  EFFECT_DENSITIES,
  EFFECT_SPEEDS,
  EFFECT_SIZE_MIN,
  EFFECT_SIZE_MAX,
  DEFAULT_EFFECT_SIZE,
  getEffectById,
  getSortedEffectSets,
  isValidEffectId,
  isValidEffectDensity,
  isValidEffectSpeed,
  isValidEffectSize,
  resolveEffectConfig,
} from "@/lib/effects";

describe("effects registry", () => {
  it("has unique ids", () => {
    const ids = EFFECT_SETS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every set has a valid mode, at least one sprite, and a positive base size", () => {
    for (const e of EFFECT_SETS) {
      expect(["fall", "float"]).toContain(e.mode);
      expect(e.sprites.length).toBeGreaterThan(0);
      expect(e.baseSizePx).toBeGreaterThan(0);
      if (e.seasonal) {
        expect(e.month).toBeGreaterThanOrEqual(1);
        expect(e.month).toBeLessThanOrEqual(12);
      }
    }
  });

  it("every referenced sprite file exists under public/", () => {
    for (const e of EFFECT_SETS) {
      for (const sprite of e.sprites) {
        const file = join(process.cwd(), "public", sprite);
        expect(existsSync(file), `${e.id}: missing sprite ${sprite}`).toBe(true);
      }
    }
  });

  it("density and speed tables define the three documented levels", () => {
    expect(Object.keys(EFFECT_DENSITIES).sort()).toEqual(["dense", "medium", "sparse"]);
    expect(Object.keys(EFFECT_SPEEDS).sort()).toEqual(["gentle", "lively", "medium"]);
    for (const { count } of Object.values(EFFECT_DENSITIES)) expect(count).toBeGreaterThan(0);
    for (const { minS, maxS } of Object.values(EFFECT_SPEEDS)) {
      expect(minS).toBeGreaterThan(0);
      expect(maxS).toBeGreaterThan(minS);
    }
  });

  it("validators accept null (no effect) and reject unknown values", () => {
    expect(isValidEffectId(null)).toBe(true);
    expect(isValidEffectId("beer")).toBe(true);
    expect(isValidEffectId("lasers")).toBe(false);
    expect(isValidEffectDensity("sparse")).toBe(true);
    expect(isValidEffectDensity("extreme")).toBe(false);
    expect(isValidEffectSpeed("lively")).toBe(true);
    expect(isValidEffectSpeed("ludicrous")).toBe(false);
  });

  it("size multiplier floor is the set's designed size, ceiling is 10x", () => {
    expect(EFFECT_SIZE_MIN).toBe(1);
    expect(EFFECT_SIZE_MAX).toBe(10);
    expect(DEFAULT_EFFECT_SIZE).toBe(EFFECT_SIZE_MIN);
    expect(isValidEffectSize(null)).toBe(true); // legacy rows: no stored size
    expect(isValidEffectSize(EFFECT_SIZE_MIN)).toBe(true);
    expect(isValidEffectSize(5.5)).toBe(true);
    expect(isValidEffectSize(EFFECT_SIZE_MAX)).toBe(true);
    expect(isValidEffectSize(0.5)).toBe(false);
    expect(isValidEffectSize(10.5)).toBe(false);
    expect(isValidEffectSize(NaN)).toBe(false);
    expect(isValidEffectSize(Infinity)).toBe(false);
  });

  it("getEffectById resolves ids and returns null otherwise", () => {
    expect(getEffectById("thanksgiving")?.name).toBe("Thanksgiving");
    expect(getEffectById(null)).toBeNull();
    expect(getEffectById("nope")).toBeNull();
  });

  it("resolves stored effect fields with shared defaults and rejects unknown effects", () => {
    expect(resolveEffectConfig(null)).toBeNull();
    expect(resolveEffectConfig({ effectId: "lasers" })).toBeNull();
    expect(resolveEffectConfig({ effectId: "confetti" })).toEqual({
      effectId: "confetti",
      density: "medium",
      speed: "medium",
      size: 1,
    });
    expect(
      resolveEffectConfig({
        effectId: "snow",
        effectDensity: "sparse",
        effectSpeed: "gentle",
        effectSize: 4,
      })
    ).toEqual({ effectId: "snow", density: "sparse", speed: "gentle", size: 4 });
  });

  it("falls back safely when persisted effect options are invalid", () => {
    expect(
      resolveEffectConfig({
        effectId: "snow",
        effectDensity: "extreme",
        effectSpeed: "ludicrous",
        effectSize: 99,
      })
    ).toEqual({ effectId: "snow", density: "medium", speed: "medium", size: 1 });
  });

  it("sorts seasonal sets by month proximity, classics after", () => {
    const october = new Date("2026-10-15");
    const sorted = getSortedEffectSets(october);
    // Halloween (10) and Beer/Oktoberfest (10) lead in October
    const firstTwo = sorted.slice(0, 2).map((e) => e.id);
    expect(firstTwo).toContain("halloween");
    expect(firstTwo).toContain("beer");
    // Year-round classics (no month) come after all seasonal sets
    const firstClassic = sorted.findIndex((e) => !e.seasonal);
    const lastSeasonal = sorted.map((e) => !!e.seasonal).lastIndexOf(true);
    expect(firstClassic).toBeGreaterThan(lastSeasonal === -1 ? -1 : -1);
    expect(sorted.slice(firstClassic).every((e) => !e.seasonal)).toBe(true);
  });
});
