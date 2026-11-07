// #825 (batch 11 of the #814 design review): hosts lost independent control of
// effect size. #811 had deliberately merged density and size into one Amount
// choice and removed the size slider.
//
// Root cause: the Amount action wrote BOTH stored fields (Less/Some → 1×,
// More → 2×), so choosing an Amount silently overwrote any size a host had
// picked, and nothing could set size on its own.
//
// Fix: Amount maps to density only (EFFECT_AMOUNTS), Size is its own control
// again (Small 3×, Medium 5×, Large 7×, plus a 1–10× slider), and each theme
// save sends the whole effect snapshot so neither choice can reset the other.

// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, within } from "@/tests/components/render";
import { ThemePanel } from "@/components/event/settings-page/ThemePanel";
import {
  effectStateToFields,
  initialEffectState,
  type EffectEditorState,
} from "@/components/event/settings-page/effect-state";
import type { EventInput, ThemeExtrasOverrides } from "@/components/event/settings-page/types";
import { EFFECT_AMOUNTS } from "@/lib/effects";
import { testTheme } from "@/tests/components/helpers/theme";

const noop = vi.fn();

function Harness({ theme, saves }: { theme: EventInput["theme"]; saves: ThemeExtrasOverrides[] }) {
  const [effect, setEffect] = useState<EffectEditorState>(() => initialEffectState(theme));
  return (
    <ThemePanel
      event={{ title: "Party", theme } as unknown as EventInput}
      themePresets={[]}
      visibleThemePresets={[]}
      themeSearch=""
      setThemeSearch={noop}
      themeFilter="all"
      setThemeFilter={noop}
      themeCustomizeOpen={false}
      setThemeCustomizeOpen={noop}
      base="DARK"
      setBase={noop}
      gradientFrom="#7c3aed"
      setGradientFrom={noop}
      gradientTo="#1e40af"
      setGradientTo={noop}
      accent="#a855f7"
      setAccent={noop}
      cardOpacity={0.85}
      setCardOpacity={noop}
      themePresetId={null}
      setThemePresetId={noop}
      fontId={null}
      setFontId={noop}
      effect={effect}
      setEffect={setEffect}
      libraryIcons={{}}
      rememberLibraryIcons={noop}
      triggerSaveTheme={(_b, _f, _t, _a, _p, _o, extras) => {
        if (extras) saves.push(extras);
      }}
      t={testTheme}
    />
  );
}

const LEGACY = {
  baseTheme: "DARK",
  gradientFrom: "#7c3aed",
  gradientTo: "#1e40af",
  accentColor: "#a855f7",
  coverImageUrl: null,
  effectId: "snow",
  effectDensity: "medium",
  effectSpeed: "medium",
  effectSize: 6,
} as EventInput["theme"];

function open(saves: ThemeExtrasOverrides[], theme = LEGACY) {
  const view = render(<Harness theme={theme} saves={saves} />);
  fireEvent.click(view.getByText("Effects"));
  return view;
}

const saved = (s: ThemeExtrasOverrides) => effectStateToFields(s.effect!);

describe("#825 Amount and Size are independent", () => {
  it("Amount steps are densities, never sizes", () => {
    expect(Object.values(EFFECT_AMOUNTS)).toEqual(["sparse", "medium", "dense"]);
  });

  it("changing Amount keeps an older event's 6× size", () => {
    const saves: ThemeExtrasOverrides[] = [];
    const { getByRole } = open(saves);
    fireEvent.click(getByRole("button", { name: "More" }));
    fireEvent.click(getByRole("button", { name: "Less" }));
    expect(saves.map(saved).map((f) => [f.effectDensity, f.effectSize])).toEqual([
      ["dense", 6],
      ["sparse", 6],
    ]);
  });

  it("changing Size keeps the Amount", () => {
    const saves: ThemeExtrasOverrides[] = [];
    const { getByRole } = open(saves, { ...LEGACY!, effectDensity: "dense" });
    const size = within(getByRole("group", { name: "Size" }));
    fireEvent.click(size.getByRole("button", { name: "Medium" }));
    expect(saved(saves[0])).toMatchObject({ effectDensity: "dense", effectSize: 5 });
  });

  it("a keyboard-only size change saves the exact value with the Amount unchanged", () => {
    const saves: ThemeExtrasOverrides[] = [];
    const { container } = open(saves, { ...LEGACY!, effectDensity: "sparse" });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "6.5" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    fireEvent.blur(slider);
    expect(saves.map(saved)).toHaveLength(1);
    expect(saved(saves[0])).toMatchObject({ effectDensity: "sparse", effectSize: 6.5 });
  });

  it("loading an older event never rewrites its size", () => {
    expect(initialEffectState(LEGACY).effectSize).toBe(6);
    expect(initialEffectState({ ...LEGACY!, effectSize: null }).effectSize).toBe(1);
    const saves: ThemeExtrasOverrides[] = [];
    open(saves);
    expect(saves).toEqual([]);
  });
});
