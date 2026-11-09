import data from "./theme-preset-data.json";
import {
  CUSTOM_EFFECT_ID,
  isLibraryIconIdShape,
  isValidLibraryIconIdList,
  isValidEffectDensity,
  isValidEffectSpeed,
  isValidEffectSize,
  isValidEffectMovement,
  type StoredEffectFields,
} from "./effects";

export const PRESET_CATEGORIES = ["general", "seasonal", "occasion"] as const;
export type PresetCategory = (typeof PRESET_CATEGORIES)[number];

export interface PresetPresentation {
  category: PresetCategory;
  tileIconId: string;
  effect: StoredEffectFields | null;
}

/** Shown until an administrator picks a tile icon. */
export const FALLBACK_TILE_ICON_ID = "noto:artist-palette";

export const BUILTIN_PRESENTATIONS = data as Record<string, PresetPresentation>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPresetCategory(value: unknown): value is PresetCategory {
  return typeof value === "string" && (PRESET_CATEGORIES as readonly string[]).includes(value);
}

function validEffect(value: unknown): value is StoredEffectFields {
  if (!isRecord(value)) return false;
  const e = value as StoredEffectFields;
  return (
    e.effectId === CUSTOM_EFFECT_ID &&
    isValidLibraryIconIdList(e.effectIconIds) &&
    isValidEffectDensity(e.effectDensity) &&
    isValidEffectSpeed(e.effectSpeed) &&
    isValidEffectSize(e.effectSize) &&
    isValidEffectMovement(e.effectMovement)
  );
}

/**
 * Narrows stored presentation JSON to a complete, canonical value (fixed key
 * order, so two equal presentations always serialize the same). A preset
 * without a valid category takes it from its `seasonal` flag, so presets saved
 * before categories existed keep their Seasonal grouping.
 */
export function presetPresentation(value: unknown, seasonal?: boolean | null): PresetPresentation {
  const p = isRecord(value) ? value : {};
  const effect = validEffect(p.effect) ? p.effect : null;
  return {
    category: isPresetCategory(p.category) ? p.category : seasonal ? "seasonal" : "general",
    tileIconId: isLibraryIconIdShape(p.tileIconId) ? p.tileIconId : FALLBACK_TILE_ICON_ID,
    effect: effect && {
      effectId: CUSTOM_EFFECT_ID,
      effectIconIds: [...(effect.effectIconIds ?? [])],
      effectDensity: effect.effectDensity ?? null,
      effectSpeed: effect.effectSpeed ?? null,
      effectSize: effect.effectSize ?? null,
      effectMovement: effect.effectMovement ?? null,
    },
  };
}

/** The single category rule for filters, badges and the admin editor. */
export function presetCategory(preset: {
  presentation?: unknown;
  seasonal?: boolean | null;
}): PresetCategory {
  return presetPresentation(preset.presentation, preset.seasonal).category;
}

/** Value equality that ignores key order (PostgreSQL JSONB reorders keys). */
export function presentationsEqual(
  a: unknown,
  b: unknown,
  seasonalA?: boolean | null,
  seasonalB?: boolean | null
): boolean {
  return (
    JSON.stringify(presetPresentation(a, seasonalA)) ===
    JSON.stringify(presetPresentation(b, seasonalB))
  );
}

export function validPresetPresentation(value: unknown): value is PresetPresentation {
  if (!isRecord(value)) return false;
  if (!isPresetCategory(value.category) || !isLibraryIconIdShape(value.tileIconId)) return false;
  return value.effect === null || validEffect(value.effect);
}

/** Older snapshots omit fields added after they were saved. Only omitted keys
 * inherit the current preset; explicit nulls and administrator choices survive.
 * Used by the administrator's Reset to default / Reset to original. */
export function normalizePresetDefaults<T extends object>(preset: T, snapshot: unknown): T {
  if (!isRecord(snapshot)) return preset;
  return { ...preset, ...snapshot };
}
