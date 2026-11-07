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
// #825: besides the built-in sets, an effect can be a "custom" mixture of one
// to three local library icons (effectId = CUSTOM_EFFECT_ID, ids in
// effectIconIds). This module only checks the SHAPE of those ids; real catalog
// membership and the icons' asset paths live behind the server-only
// lib/effect-catalog.ts, which hands resolveEffectConfig() small {id, src}
// descriptors. Never import the catalog data from here.
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
export const EFFECT_SIZE_STEP = 0.5;
/** How a stored null size reads: older active effects keep their designed 1× size. */
export const DEFAULT_EFFECT_SIZE = EFFECT_SIZE_MIN;

/**
 * #825: Size is its own control again, with three quick choices and the
 * 1–10× slider for anything in between. A genuinely new effect starts Small.
 */
export type EffectSizePreset = "small" | "medium" | "large";

export const EFFECT_SIZE_PRESETS: Record<EffectSizePreset, number> = {
  small: 3,
  medium: 5,
  large: 7,
};

export const NEW_EFFECT_SIZE = EFFECT_SIZE_PRESETS.small;

/** The quick choice a size matches exactly, or null (e.g. a stored 6× or 2.5×). */
export function effectSizePresetFor(size: number | null | undefined): EffectSizePreset | null {
  const match = (Object.keys(EFFECT_SIZE_PRESETS) as EffectSizePreset[]).find(
    (preset) => EFFECT_SIZE_PRESETS[preset] === size
  );
  return match ?? null;
}

/**
 * The size an editor starts from: any stored number exactly as stored (never
 * snapped), 1× for an already active legacy effect with no stored size, and
 * the Small default for an event that has never had an effect.
 */
export function initialEffectSize(source: StoredEffectFields | null | undefined): number {
  const stored = source?.effectSize;
  if (stored != null && isValidEffectSize(stored)) return stored;
  return source?.effectId ? DEFAULT_EFFECT_SIZE : NEW_EFFECT_SIZE;
}

/**
 * Amount sets how many motifs drift by — particle count only.
 *
 * #811 briefly made Amount write both density and size (Less/Some = 1×,
 * More = 2×) and removed the size slider. #825 reverses that coupling: Amount
 * maps to density alone and Size is independent again. Sizes already stored by
 * an #811 Amount choice are kept as they are.
 */
export type EffectAmount = "less" | "some" | "more";

export const EFFECT_AMOUNTS: Record<EffectAmount, EffectDensity> = {
  less: "sparse",
  some: "medium",
  more: "dense",
};

/** The Amount step a stored density reads as ("some" for null/unknown). */
export function effectAmountFor(density: string | null | undefined): EffectAmount {
  return density === "sparse" ? "less" : density === "dense" ? "more" : "some";
}

/**
 * #825: movement applies to the whole effect. "random" means free drift —
 * each particle crosses the screen on its own path (sideways and diagonal
 * too), not one shared direction per page load. A stored null keeps each
 * built-in set's own fall/float and makes a custom mixture drift randomly.
 */
export type EffectMovement = "up" | "down" | "random";

export const EFFECT_MOVEMENTS: readonly EffectMovement[] = ["up", "down", "random"];

export function isValidEffectMovement(m: string | null | undefined): boolean {
  return m == null || (EFFECT_MOVEMENTS as readonly string[]).includes(m);
}

/** The movement an effect shows when the host hasn't picked one. */
export function inheritedEffectMovement(effectId: string | null | undefined): EffectMovement {
  if (effectId === CUSTOM_EFFECT_ID) return "random";
  return getEffectById(effectId)?.mode === "float" ? "up" : "down";
}

/** Reserved effectId for a mixture of library icons (never an EFFECT_SETS entry). */
export const CUSTOM_EFFECT_ID = "custom";
export const MAX_LIBRARY_ICONS = 3;
/** Common nominal size for library art before the host's multiplier. */
export const LIBRARY_ICON_BASE_SIZE_PX = 22;

/**
 * The prepared library collection. #825 shipped Fluent Emoji Flat as well, but
 * every Fluent icon duplicated a Noto emoji, so the library is Noto-only.
 */
export const LIBRARY_COLLECTION_IDS = ["noto"] as const;
export type LibraryCollectionId = (typeof LIBRARY_COLLECTION_IDS)[number];

const LIBRARY_ICON_ID = /^noto:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIBRARY_ICON_ID_MAX_LENGTH = 120;
const LIBRARY_ICON_SRC = /^\/effects\/library\/noto\/[0-9.]+\/[a-z0-9-]+\.svg$/;

/** Shape check only — real membership is checked server-side by the catalog. */
export function isLibraryIconIdShape(id: unknown): id is string {
  return (
    typeof id === "string" && id.length <= LIBRARY_ICON_ID_MAX_LENGTH && LIBRARY_ICON_ID.test(id)
  );
}

/** One to three unique, well-formed library icon ids. */
export function isValidLibraryIconIdList(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length >= 1 &&
    ids.length <= MAX_LIBRARY_ICONS &&
    ids.every(isLibraryIconIdShape) &&
    new Set(ids).size === ids.length
  );
}

/** Only prepared, versioned same-origin library paths may ever render. */
export function isTrustedLibrarySrc(src: unknown): src is string {
  return typeof src === "string" && LIBRARY_ICON_SRC.test(src);
}

/** A resolved library icon: its stable id and its trusted same-origin sprite. */
export interface LibraryIconRef {
  id: string;
  src: string;
}

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

/** null (no effect) or one of the built-in sets. */
export function isValidEffectId(id: string | null | undefined): boolean {
  return id == null || EFFECT_SETS.some((e) => e.id === id);
}

/** null, a built-in set, or the reserved custom-mixture id. */
export function isValidEffectSource(id: string | null | undefined): boolean {
  return id === CUSTOM_EFFECT_ID || isValidEffectId(id);
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

/** The small resolved effect the shared web renderer needs. */
export interface EffectConfig {
  /** A built-in set id, or CUSTOM_EFFECT_ID for a library mixture */
  effectId: string;
  density: EffectDensity;
  speed: EffectSpeed;
  /** Sprite size multiplier (1-10); omitted = 1 */
  size?: number;
  /** Omitted = inheritedEffectMovement(effectId) */
  movement?: EffectMovement;
  /** CUSTOM_EFFECT_ID only: the selected icons in the host's order */
  libraryIcons?: LibraryIconRef[];
}

/** The effect fields stored on EventTheme (shared by actions, settings and routes). */
export interface StoredEffectFields {
  effectId?: string | null;
  effectIconIds?: string[] | null;
  effectDensity?: string | null;
  effectSpeed?: string | null;
  effectSize?: number | null;
  effectMovement?: string | null;
}

/** @deprecated use StoredEffectFields */
export type StoredEffectConfig = StoredEffectFields;

/**
 * Resolve persisted theme fields into the shared web effect configuration.
 *
 * For a custom mixture, `libraryIcons` are the already-resolved catalog
 * descriptors (from the server-only catalog, or from search results the
 * server returned). Any stored id without a trusted descriptor — a malformed
 * list, an id no longer in the catalog — fails safe to no effect at all.
 */
export function resolveEffectConfig(
  source: StoredEffectFields | null | undefined,
  libraryIcons?: readonly LibraryIconRef[] | null
): EffectConfig | null {
  const effectId = source?.effectId;
  if (!effectId) return null;

  let resolvedIcons: LibraryIconRef[] | undefined;
  if (effectId === CUSTOM_EFFECT_ID) {
    const ids = source.effectIconIds;
    if (!isValidLibraryIconIdList(ids)) return null;
    const byId = new Map((libraryIcons ?? []).map((icon) => [icon.id, icon]));
    resolvedIcons = [];
    for (const id of ids) {
      const icon = byId.get(id);
      if (!icon || !isTrustedLibrarySrc(icon.src)) return null;
      resolvedIcons.push({ id, src: icon.src });
    }
  } else if (!getEffectById(effectId)) {
    return null;
  }

  const density = source.effectDensity;
  const speed = source.effectSpeed;
  const size = source.effectSize;
  const movement = source.effectMovement;

  return {
    effectId,
    density:
      density && isValidEffectDensity(density)
        ? (density as EffectDensity)
        : DEFAULT_EFFECT_DENSITY,
    speed: speed && isValidEffectSpeed(speed) ? (speed as EffectSpeed) : DEFAULT_EFFECT_SPEED,
    size: size != null && isValidEffectSize(size) ? size : DEFAULT_EFFECT_SIZE,
    movement:
      movement && isValidEffectMovement(movement)
        ? (movement as EffectMovement)
        : inheritedEffectMovement(effectId),
    ...(resolvedIcons ? { libraryIcons: resolvedIcons } : {}),
  };
}

/** What the renderer draws for a resolved effect: sprites plus their look. */
export interface EffectPresentation {
  /** Built-in set id or CUSTOM_EFFECT_ID */
  id: string;
  sprites: string[];
  baseSizePx: number;
  /** Mask the sprite and color it from the theme (built-in tinted sets only) */
  tinted: boolean;
  /** Fall-style art tumbles as it travels; float-style art barely turns */
  character: EffectMode;
  /** Built-in float sets pulse gently (opacity/scale) */
  twinkle: boolean;
}

export function getEffectPresentation(config: EffectConfig | null): EffectPresentation | null {
  if (!config) return null;
  if (config.effectId === CUSTOM_EFFECT_ID) {
    const sprites = (config.libraryIcons ?? []).map((icon) => icon.src).filter(isTrustedLibrarySrc);
    if (sprites.length === 0) return null;
    return {
      id: CUSTOM_EFFECT_ID,
      sprites,
      baseSizePx: LIBRARY_ICON_BASE_SIZE_PX,
      tinted: false,
      character: "float",
      twinkle: false,
    };
  }
  const set = getEffectById(config.effectId);
  if (!set) return null;
  return {
    id: set.id,
    sprites: set.sprites,
    baseSizePx: set.baseSizePx,
    tinted: !!set.tinted,
    character: set.mode,
    twinkle: set.mode === "float",
  };
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
