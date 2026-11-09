// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@/tests/components/render";
import { waitFor, within } from "@testing-library/react";
import { normalizePresetDefaults, BUILTIN_PRESENTATIONS } from "@/lib/theme-preset-presentation";
import { getDefaultCardOpacity, THEME_PRESETS } from "@/lib/theme";
import { readFileSync, existsSync } from "node:fs";
import { EffectsPanel } from "@/components/event/settings-page/EffectsPanel";
import { initialEffectState } from "@/components/event/settings-page/effect-state";
import { ThemeBackground } from "@/components/event/ThemeBackground";
import { resolveTheme } from "@/lib/theme";
import React from "react";
import { ThemePanel } from "@/components/event/settings-page/ThemePanel";

import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "@/tests/components/helpers/theme";
import type { EventInput } from "@/components/event/settings-page/types";

import type { EffectEditorState } from "@/components/event/settings-page/effect-state";

const noop = vi.fn();

const CONFETTI: EffectEditorState = {
  effectId: "confetti",
  effectIconIds: [],
  effectDensity: "medium",
  effectSpeed: "medium",
  effectSize: 3,
  effectMovement: null,
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ThemePanel>> = {},
  locale: "en-US" | "nl-NL" = "en-US"
) {
  const event = {
    title: "Summer Gala",
    theme: {
      baseTheme: "DARK",
      gradientFrom: "#7c3aed",
      gradientTo: "#1e40af",
      accentColor: "#a855f7",
      coverImageUrl: null,
      fontId: null,
    },
  } as unknown as EventInput;
  return render(
    <ThemePanel
      event={event}
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
      fontId="playfair"
      setFontId={noop}
      effect={CONFETTI}
      setEffect={noop}
      libraryIcons={{}}
      rememberLibraryIcons={noop}
      triggerSaveTheme={noop}
      t={testTheme}
      {...overrides}
    />,
    { locale, messages: locale === "nl-NL" ? dutch : english }
  );
}

// Root cause (01a1baab): preset tiles relied on OS emoji, and preset selection
// saved colors/fonts only, so Noto mixtures could not be preloaded or customized.
const patricks = {
  ...THEME_PRESETS.find((p) => p.id === "st-patricks")!,
  presentation: BUILTIN_PRESENTATIONS["st-patricks"],
};
describe("preset defaults regression", () => {
  it("uses bundled artwork for every built-in tile and effect", () => {
    for (const p of Object.values(BUILTIN_PRESENTATIONS)) {
      for (const id of [p.tileIconId, ...(p.effect?.effectIconIds ?? [])])
        expect(existsSync(`public/effects/library/noto/1.2.10/${id.slice(5)}.svg`), id).toBe(true);
    }
  });
  it("selects a complete editable St Patrick mixture", async () => {
    const setEffect = vi.fn(),
      triggerSaveTheme = vi.fn();
    const ui = renderPanel({
      themePresets: [patricks],
      visibleThemePresets: [patricks],
      setEffect,
      triggerSaveTheme,
    });
    fireEvent.click(ui.getByRole("button", { name: "St. Patrick's Day" }));
    await waitFor(() => expect(setEffect).toHaveBeenCalledWith(patricks.presentation.effect));
    expect(triggerSaveTheme.mock.calls[0][6].effect.effectIconIds).toEqual([
      "noto:shamrock",
      "noto:four-leaf-clover",
    ]);
  });
  it("warns before overwriting customization and Cancel keeps settings", async () => {
    const save = vi.fn();
    const ui = renderPanel({
      themePresets: [patricks],
      visibleThemePresets: [patricks],
      themePresetId: patricks.id,
      triggerSaveTheme: save,
    });
    fireEvent.click(ui.getByRole("button", { name: "St. Patrick's Day" }));
    await waitFor(() => expect(ui.getByRole("dialog")).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Cancel" }));
    expect(save).not.toHaveBeenCalled();
  });
  it("renders enlarged moving soft fields with a reduced-motion fallback", () => {
    const ui = render(
      <ThemeBackground theme={resolveTheme("SOFT", "#fda4af", "#ddd6fe", "#ec4899")} />
    );
    expect(ui.container.querySelectorAll(".rsvp-soft-cloud")).toHaveLength(2);
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("@keyframes rsvp-soft-drift-one");
    expect(css).toMatch(
      /prefers-reduced-motion: reduce[\s\S]*rsvp-soft-cloud[\s\S]*animation: none/
    );
  });
});

// The preloaded mixture is the ordinary editor selection, not a locked set.
it("lets a host remove a preloaded shamrock and keep the clover", () => {
  const icons = Object.fromEntries(
    ["shamrock", "four-leaf-clover"].map((name) => {
      const id = "noto:" + name;
      return [
        id,
        {
          id,
          collection: "noto" as const,
          src: "/effects/library/noto/1.2.10/" + name + ".svg",
          labels: { "en-US": name, "nl-NL": name, "de-DE": name, "es-ES": name },
        },
      ];
    })
  );
  const commit = vi.fn();
  const ui = render(
    <EffectsPanel
      eventId="event"
      t={testTheme}
      effect={initialEffectState(patricks.presentation.effect)}
      libraryIcons={icons}
      onPreview={vi.fn()}
      onCommit={commit}
    />
  );
  fireEvent.click(ui.getByRole("button", { name: "Remove shamrock" }));
  expect(commit.mock.calls[0][0].effectIconIds).toEqual(["noto:four-leaf-clover"]);
  expect(commit.mock.calls[0][0].effectMovement).toBe("random");
});

// Root cause (01a1baab review M1): a tile applied the live preset, while the
// customization check and Restore used the administrator's default snapshot.
// An admin's plain Save therefore made a freshly applied preset look customized,
// and Restore brought back the older snapshot. Hosts now use the live preset for
// all three; Restore asks first with its own wording (review Q1).
describe("live preset baseline", () => {
  const edited = {
    ...patricks,
    presentation: {
      ...patricks.presentation,
      effect: { ...patricks.presentation.effect!, effectIconIds: ["noto:four-leaf-clover"] },
    },
    defaultSnapshot: { ...patricks, presentation: patricks.presentation },
  };
  const applied = (overrides: Partial<React.ComponentProps<typeof ThemePanel>> = {}) =>
    renderPanel({
      themePresets: [edited],
      visibleThemePresets: [edited],
      themePresetId: edited.id,
      base: edited.base,
      gradientFrom: edited.gradientFrom,
      gradientTo: edited.gradientTo,
      accent: edited.accentColor,
      cardOpacity: getDefaultCardOpacity(edited.base),
      fontId: null,
      effect: initialEffectState(edited.presentation.effect),
      ...overrides,
    });

  it("shows no Restore or warning right after applying an admin-edited preset", async () => {
    const save = vi.fn();
    const ui = applied({ triggerSaveTheme: save });
    expect(ui.queryByRole("button", { name: /Restore to/ })).toBeNull();
    fireEvent.click(ui.getByRole("button", { name: "St. Patrick's Day" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(ui.queryByRole("dialog")).toBeNull();
    expect(save.mock.calls[0][6].effect.effectIconIds).toEqual(["noto:four-leaf-clover"]);
  });

  it("restores the live preset after a Restore confirmation", async () => {
    const save = vi.fn(),
      setEffect = vi.fn(),
      setAccent = vi.fn();
    const ui = applied({ accent: "#000000", triggerSaveTheme: save, setEffect, setAccent });
    fireEvent.click(ui.getByRole("button", { name: /Restore to/ }));
    const dialog = await ui.findByRole("dialog", { name: "Restore “St. Patrick's Day” defaults?" });
    expect(
      within(dialog).getByText(
        "This replaces your customized theme, font and effects with the preset’s defaults."
      )
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBe(document.activeElement);
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(setAccent).toHaveBeenCalledWith(edited.accentColor);
    expect(save.mock.calls[0][6].effect.effectIconIds).toEqual(["noto:four-leaf-clover"]);
  });

  it("keeps the customized settings when Restore is cancelled", async () => {
    const save = vi.fn();
    const ui = applied({ accent: "#000000", triggerSaveTheme: save });
    fireEvent.click(ui.getByRole("button", { name: /Restore to/ }));
    const dialog = await ui.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(ui.queryByRole("dialog")).toBeNull());
    expect(save).not.toHaveBeenCalled();
  });
});

// Older defaults predate the font field: omission is not an explicit null.
describe("legacy preset snapshots", () => {
  for (const id of ["winter-holidays", "new-years", "valentines"]) {
    it(id + " applies without false customization or restore controls", async () => {
      const definition = THEME_PRESETS.find((p) => p.id === id)!;
      const { fontId: omitted, ...legacy } = definition;
      expect(omitted).toBeTruthy();
      const preset = {
        ...definition,
        presentation: BUILTIN_PRESENTATIONS[id],
        defaultSnapshot: { ...legacy, presentation: BUILTIN_PRESENTATIONS[id] },
      };
      const save = vi.fn();
      const ui = renderPanel({
        themePresets: [preset],
        visibleThemePresets: [preset],
        themePresetId: id,
        base: preset.base,
        gradientFrom: preset.gradientFrom,
        gradientTo: preset.gradientTo,
        accent: preset.accentColor,
        cardOpacity: getDefaultCardOpacity(preset.base),
        fontId: preset.fontId ?? null,
        effect: initialEffectState(preset.presentation.effect),
        triggerSaveTheme: save,
      });
      expect(ui.queryByRole("button", { name: /Restore to/ })).toBeNull();
      fireEvent.click(ui.getByRole("button", { name: preset.name }));
      await waitFor(() => expect(save).toHaveBeenCalledOnce());
      expect(ui.queryByRole("dialog")).toBeNull();
    });
  }
  it("preserves explicit saved values including a null font", () => {
    expect(normalizePresetDefaults({ fontId: "lora", cardOpacity: 0.8 }, { fontId: null })).toEqual(
      { fontId: null, cardOpacity: 0.8 }
    );
  });
});
