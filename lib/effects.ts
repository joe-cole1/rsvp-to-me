// Animated background "Effects" — Partiful-style drifting motif layers.
//
// Effects are fully independent of themes: hosts pick any effect set for any
// theme (turkeys on St. Patrick's is a feature, not a bug). Every event
// defaults to NO effect; selection is host-opt-in via the theme builder.
//
// Pure data module — safe for vitest, client, and server imports. Sprites are
// static SVGs under public/effects/<set>/. Sets with `tinted: true` ship
// white-fill sprites rendered via CSS mask-image so each particle can be
// colored from the event's theme (accent + gradient stops).
//
// Email degradation contract (AGENTS.md): effects are a web-only capability
// and degrade to NOTHING in email — see resolveEmailTheme() in
// lib/email-theme.ts.

export type EffectMode = "fall" | "float";
export type EffectDensity = "sparse" | "medium" | "dense";
export type EffectSpeed = "gentle" | "medium" | "lively";

export interface EffectSet {
  id: string;
  name: string;
  /** Emoji used on the picker chip (sprites are SVGs, this is just UI) */
  emoji: string;
  /** fall = drift down with sway/rotation; float = rise with wobble/twinkle */
  mode: EffectMode;
  /** Sprite URLs under public/, e.g. "/effects/hearts/heart-1.svg" */
  sprites: string[];
  /** White-fill sprites rendered via CSS mask and colored from the theme */
  tinted?: boolean;
  /** Seasonal sets sort to the front of the picker near their month */
  seasonal?: boolean;
  month?: number; // 1-12
  /** Base sprite size in px (each particle randomizes ±40%) */
  baseSizePx: number;
}

export const EFFECT_DENSITIES: Record<EffectDensity, { label: string; count: number }> = {
  sparse: { label: "Sparse", count: 10 },
  medium: { label: "Medium", count: 18 },
  dense: { label: "Dense", count: 28 },
};

/** Animation duration range (seconds) per speed — one full traversal */
export const EFFECT_SPEEDS: Record<EffectSpeed, { label: string; minS: number; maxS: number }> = {
  gentle: { label: "Gentle", minS: 18, maxS: 30 },
  medium: { label: "Medium", minS: 11, maxS: 19 },
  lively: { label: "Lively", minS: 6, maxS: 12 },
};

export const DEFAULT_EFFECT_DENSITY: EffectDensity = "medium";
export const DEFAULT_EFFECT_SPEED: EffectSpeed = "medium";

/**
 * Sprite size multiplier applied on top of each set's baseSizePx.
 * 1 = the set's designed size (the floor); 10 = ten times larger.
 */
export const EFFECT_SIZE_MIN = 1;
export const EFFECT_SIZE_MAX = 10;
export const DEFAULT_EFFECT_SIZE = EFFECT_SIZE_MIN;

export const EFFECT_SETS: EffectSet[] = [
  // ── Classics (year-round) ──
  {
    id: "confetti",
    name: "Confetti",
    emoji: "🎉",
    mode: "fall",
    tinted: true,
    baseSizePx: 14,
    sprites: [
      "/effects/confetti/rect.svg",
      "/effects/confetti/circle.svg",
      "/effects/confetti/triangle.svg",
      "/effects/confetti/squiggle.svg",
    ],
  },
  {
    id: "hearts",
    name: "Hearts",
    emoji: "❤️",
    mode: "fall",
    seasonal: true,
    month: 2,
    baseSizePx: 22,
    sprites: [
      "/effects/hearts/heart-1.svg",
      "/effects/hearts/heart-2.svg",
      "/effects/hearts/heart-3.svg",
    ],
  },
  {
    id: "balloons",
    name: "Balloons",
    emoji: "🎈",
    mode: "float",
    tinted: true,
    baseSizePx: 34,
    sprites: ["/effects/balloons/balloon.svg", "/effects/balloons/balloon-heart.svg"],
  },
  {
    id: "bubbles",
    name: "Bubbles",
    emoji: "🫧",
    mode: "float",
    baseSizePx: 24,
    sprites: [
      "/effects/bubbles/bubble-1.svg",
      "/effects/bubbles/bubble-2.svg",
      "/effects/bubbles/bubble-3.svg",
    ],
  },
  {
    id: "stars",
    name: "Stars",
    emoji: "✨",
    mode: "float",
    baseSizePx: 20,
    sprites: [
      "/effects/stars/star-5.svg",
      "/effects/stars/star-4.svg",
      "/effects/stars/sparkle.svg",
    ],
  },
  {
    id: "beer",
    name: "Beer",
    emoji: "🍺",
    mode: "float",
    seasonal: true,
    month: 10,
    baseSizePx: 28,
    sprites: [
      "/effects/beer/mug.svg",
      "/effects/beer/bottle-cap.svg",
      "/effects/beer/pretzel.svg",
      "/effects/bubbles/bubble-3.svg",
    ],
  },
  // ── Seasonal ──
  {
    id: "fireworks",
    name: "Fireworks",
    emoji: "🎆",
    mode: "float",
    seasonal: true,
    month: 7,
    baseSizePx: 26,
    sprites: ["/effects/fireworks/spark.svg", "/effects/fireworks/starburst.svg"],
  },
  {
    id: "sun-palms",
    name: "Sun & Palms",
    emoji: "🌴",
    mode: "fall",
    seasonal: true,
    month: 6,
    baseSizePx: 30,
    sprites: [
      "/effects/sun-palms/palm-frond.svg",
      "/effects/sun-palms/beach-ball.svg",
      "/effects/sun-palms/sun.svg",
    ],
  },
  {
    id: "autumn-leaves",
    name: "Autumn Leaves",
    emoji: "🍂",
    mode: "fall",
    seasonal: true,
    month: 9,
    baseSizePx: 24,
    sprites: [
      "/effects/autumn-leaves/leaf-maple.svg",
      "/effects/autumn-leaves/leaf-oak.svg",
      "/effects/autumn-leaves/leaf-birch.svg",
    ],
  },
  {
    id: "football",
    name: "Football",
    emoji: "🏈",
    mode: "fall",
    seasonal: true,
    month: 2,
    baseSizePx: 26,
    sprites: ["/effects/football/football.svg", "/effects/football/pennant.svg"],
  },
  {
    id: "halloween",
    name: "Halloween",
    emoji: "🎃",
    mode: "fall",
    seasonal: true,
    month: 10,
    baseSizePx: 26,
    sprites: [
      "/effects/halloween/bat.svg",
      "/effects/halloween/ghost.svg",
      "/effects/halloween/pumpkin.svg",
      "/effects/halloween/candy-corn.svg",
    ],
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    emoji: "🦃",
    mode: "fall",
    seasonal: true,
    month: 11,
    baseSizePx: 28,
    sprites: [
      "/effects/thanksgiving/turkey.svg",
      "/effects/thanksgiving/drumstick.svg",
      "/effects/halloween/pumpkin.svg",
      "/effects/autumn-leaves/leaf-maple.svg",
    ],
  },
  {
    id: "snow",
    name: "Snow",
    emoji: "🌨️",
    mode: "fall",
    seasonal: true,
    month: 12,
    baseSizePx: 12,
    sprites: ["/effects/snow/dot-1.svg", "/effects/snow/dot-2.svg", "/effects/snow/dot-3.svg"],
  },
  {
    id: "snowflakes",
    name: "Snowflakes",
    emoji: "❄️",
    mode: "fall",
    seasonal: true,
    month: 12,
    baseSizePx: 20,
    sprites: [
      "/effects/snowflakes/flake-1.svg",
      "/effects/snowflakes/flake-2.svg",
      "/effects/snowflakes/flake-3.svg",
    ],
  },
  {
    id: "winter-holidays",
    name: "Christmas",
    emoji: "🎄",
    mode: "fall",
    seasonal: true,
    month: 12,
    baseSizePx: 24,
    sprites: [
      "/effects/winter-holidays/ornament.svg",
      "/effects/winter-holidays/candy-cane.svg",
      "/effects/winter-holidays/holly.svg",
      "/effects/snowflakes/flake-1.svg",
    ],
  },
  {
    id: "presents",
    name: "Presents",
    emoji: "🎁",
    mode: "fall",
    seasonal: true,
    month: 12,
    baseSizePx: 26,
    sprites: [
      "/effects/presents/gift-1.svg",
      "/effects/presents/gift-2.svg",
      "/effects/presents/gift-3.svg",
    ],
  },
  {
    id: "shamrocks",
    name: "Shamrocks",
    emoji: "🍀",
    mode: "fall",
    seasonal: true,
    month: 3,
    baseSizePx: 22,
    sprites: [
      "/effects/shamrocks/clover-3.svg",
      "/effects/shamrocks/clover-4.svg",
      "/effects/shamrocks/coin.svg",
    ],
  },
  {
    id: "easter",
    name: "Easter",
    emoji: "🐣",
    mode: "fall",
    seasonal: true,
    month: 3,
    baseSizePx: 24,
    sprites: [
      "/effects/easter/egg-1.svg",
      "/effects/easter/egg-2.svg",
      "/effects/easter/egg-3.svg",
      "/effects/easter/bunny.svg",
    ],
  },
  {
    id: "blossoms",
    name: "Blossoms",
    emoji: "🌸",
    mode: "fall",
    seasonal: true,
    month: 4,
    baseSizePx: 18,
    sprites: [
      "/effects/blossoms/petal.svg",
      "/effects/blossoms/blossom.svg",
      "/effects/blossoms/blossom-small.svg",
    ],
  },
];

export function getEffectById(id: string | null | undefined): EffectSet | null {
  if (!id) return null;
  return EFFECT_SETS.find((e) => e.id === id) ?? null;
}

export function isValidEffectId(id: string | null | undefined): boolean {
  return id == null || EFFECT_SETS.some((e) => e.id === id);
}

export function isValidEffectDensity(d: string | null | undefined): boolean {
  return d == null || d in EFFECT_DENSITIES;
}

export function isValidEffectSpeed(s: string | null | undefined): boolean {
  return s == null || s in EFFECT_SPEEDS;
}

export function isValidEffectSize(n: number | null | undefined): boolean {
  return n == null || (Number.isFinite(n) && n >= EFFECT_SIZE_MIN && n <= EFFECT_SIZE_MAX);
}

/** Effect configuration as stored on EventTheme */
export interface EffectConfig {
  effectId: string;
  density: EffectDensity;
  speed: EffectSpeed;
  /** Sprite size multiplier (1-10); omitted = 1 */
  size?: number;
}

/**
 * Sort for the effect picker: seasonal sets nearest the current month first
 * (same date-proximity logic as theme presets), then year-round classics.
 * Suggestion only — nothing is ever auto-applied.
 */
export function getSortedEffectSets(now = new Date()): EffectSet[] {
  const currentMonth = now.getMonth() + 1;
  return [...EFFECT_SETS].sort((a, b) => {
    const aSeasonal = !!(a.seasonal && a.month != null);
    const bSeasonal = !!(b.seasonal && b.month != null);
    if (aSeasonal && !bSeasonal) return -1;
    if (!aSeasonal && bSeasonal) return 1;
    if (aSeasonal && bSeasonal) {
      const aDist = (a.month! - currentMonth + 12) % 12;
      const bDist = (b.month! - currentMonth + 12) % 12;
      if (aDist !== bDist) return aDist - bDist;
    }
    return a.name.localeCompare(b.name);
  });
}
