// The Effects editor's state: one object for every stored effect field, so a
// change always saves a complete, current snapshot (#825). Amount, Size,
// Speed and Movement are independent of each other and of the motif.

import {
  CUSTOM_EFFECT_ID,
  DEFAULT_EFFECT_DENSITY,
  DEFAULT_EFFECT_SPEED,
  initialEffectSize,
  isValidEffectMovement,
  type EffectMovement,
  type StoredEffectFields,
} from "@/lib/effects";

export interface EffectEditorState {
  /** null = None, a built-in set id, or CUSTOM_EFFECT_ID */
  effectId: string | null;
  /** The custom mixture in the host's order ([] unless effectId is custom) */
  effectIconIds: string[];
  effectDensity: string;
  effectSpeed: string;
  effectSize: number;
  /** null = inherit (each built-in's own direction; Random for a mixture) */
  effectMovement: EffectMovement | null;
}

export function initialEffectState(
  theme: StoredEffectFields | null | undefined
): EffectEditorState {
  const effectId = theme?.effectId ?? null;
  const movement = theme?.effectMovement ?? null;
  return {
    effectId,
    effectIconIds: effectId === CUSTOM_EFFECT_ID ? [...(theme?.effectIconIds ?? [])] : [],
    effectDensity: theme?.effectDensity ?? DEFAULT_EFFECT_DENSITY,
    effectSpeed: theme?.effectSpeed ?? DEFAULT_EFFECT_SPEED,
    effectSize: initialEffectSize(theme),
    effectMovement:
      movement && isValidEffectMovement(movement) ? (movement as EffectMovement) : null,
  };
}

/** Every stored field, explicitly — what each theme autosave sends. */
export function effectStateToFields(state: EffectEditorState): Required<StoredEffectFields> {
  return {
    effectId: state.effectId,
    effectIconIds: state.effectId === CUSTOM_EFFECT_ID ? [...state.effectIconIds] : [],
    effectDensity: state.effectDensity,
    effectSpeed: state.effectSpeed,
    effectSize: state.effectSize,
    effectMovement: state.effectMovement,
  };
}

export function effectStatesEqual(a: EffectEditorState, b: EffectEditorState): boolean {
  return (
    a.effectId === b.effectId &&
    a.effectDensity === b.effectDensity &&
    a.effectSpeed === b.effectSpeed &&
    a.effectSize === b.effectSize &&
    a.effectMovement === b.effectMovement &&
    a.effectIconIds.length === b.effectIconIds.length &&
    a.effectIconIds.every((id, i) => id === b.effectIconIds[i])
  );
}
