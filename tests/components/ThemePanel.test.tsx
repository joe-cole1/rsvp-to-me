// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@/tests/components/render";
import { within } from "@testing-library/react";
import React from "react";
import { ThemePanel } from "@/components/event/settings-page/ThemePanel";
import { GuestSharingCard } from "@/components/event/event-page/GuestSharingCard";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "./helpers/theme";
import type { EventInput } from "@/components/event/settings-page/types";
import type { EventData } from "@/components/event/event-page/types";
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

describe("ThemePanel tabs", () => {
  it("defaults to the Theme tab: presets + customize, no effect or font controls", () => {
    const { container, queryByText, getByPlaceholderText } = renderPanel();
    expect(getByPlaceholderText("Search themes…")).toBeTruthy();
    expect(queryByText("Customize colors")).toBeTruthy();
    expect(queryByText("Amount")).toBeNull();
    expect(queryByText("Theme default")).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("Effects tab shows the picker, a labeled icon search, and four independent controls", () => {
    const { container, getByText, getByLabelText, queryByPlaceholderText } = renderPanel();
    fireEvent.click(getByText("Effects"));
    expect(queryByPlaceholderText("Search themes…")).toBeNull();
    expect(getByText("None")).toBeTruthy();
    expect(getByLabelText("Search icons")).toHaveAttribute("type", "search");
    // Amount, Size, Speed and Movement stack in one column
    const labels = ["Amount", "Size", "Speed", "Movement"].map((name) => getByText(name));
    const column = labels[0].parentElement!.parentElement as HTMLElement;
    expect(column.style.flexDirection).toBe("column");
    for (const label of labels) expect(label.parentElement!.parentElement).toBe(column);
    // #825 restores the size slider: 1–10× in 0.5 steps
    const slider = container.querySelector('input[type="range"]')!;
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "10");
    expect(slider).toHaveAttribute("step", "0.5");
  });

  it("an Amount step saves the density and leaves Size alone", () => {
    const setEffect = vi.fn();
    const triggerSaveTheme = vi.fn();
    const { getByText, getByRole } = renderPanel({
      effect: { ...CONFETTI, effectSize: 6 },
      setEffect,
      triggerSaveTheme,
    });
    fireEvent.click(getByText("Effects"));
    expect(getByRole("button", { name: "Some" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "More" }));
    const next = { ...CONFETTI, effectSize: 6, effectDensity: "dense" };
    expect(setEffect).toHaveBeenCalledWith(next);
    expect(triggerSaveTheme).toHaveBeenCalledWith(
      "DARK",
      "#7c3aed",
      "#1e40af",
      "#a855f7",
      undefined,
      undefined,
      { effect: next }
    );
  });

  it("a Size choice saves the size and leaves Amount alone", () => {
    const setEffect = vi.fn();
    const { getByText, getByRole } = renderPanel({
      effect: { ...CONFETTI, effectDensity: "sparse" },
      setEffect,
    });
    fireEvent.click(getByText("Effects"));
    expect(getByRole("button", { name: "Small" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "Large" }));
    expect(setEffect).toHaveBeenCalledWith({ ...CONFETTI, effectDensity: "sparse", effectSize: 7 });
  });

  it("an older event shows its stored size and Amount step as they are", () => {
    const { container, getByText, getByRole } = renderPanel({
      effect: { ...CONFETTI, effectDensity: "sparse", effectSize: 6 },
    });
    fireEvent.click(getByText("Effects"));
    expect(getByRole("button", { name: "Less" })).toHaveAttribute("aria-pressed", "true");
    const size = within(getByRole("group", { name: "Size" }));
    for (const name of ["Small", "Medium", "Large"]) {
      expect(size.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(container.querySelector("output")!.textContent).toBe("6×");
  });

  it("movement shows the set's own direction until the host picks one", () => {
    const setEffect = vi.fn();
    const { getByText, getByRole } = renderPanel({ setEffect });
    fireEvent.click(getByText("Effects"));
    // Confetti falls
    expect(getByRole("button", { name: "Down" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "Random" }));
    expect(setEffect).toHaveBeenCalledWith({ ...CONFETTI, effectMovement: "random" });
  });

  it("reset restores the saved effect, including its mixture", () => {
    const setEffect = vi.fn();
    const triggerSaveTheme = vi.fn();
    const event = {
      title: "Summer Gala",
      theme: {
        baseTheme: "DARK",
        gradientFrom: "#7c3aed",
        gradientTo: "#1e40af",
        accentColor: "#a855f7",
        coverImageUrl: null,
        fontId: "playfair",
        cardOpacity: 0.85,
        effectId: "custom",
        effectIconIds: ["noto:cat"],
        effectSize: 6,
        effectMovement: "up",
      },
    } as unknown as EventInput;
    const { getByRole } = renderPanel({ event, setEffect, triggerSaveTheme });
    fireEvent.click(getByRole("button", { name: "↺ Reset" }));
    const saved = {
      effectId: "custom",
      effectIconIds: ["noto:cat"],
      effectDensity: "medium",
      effectSpeed: "medium",
      effectSize: 6,
      effectMovement: "up",
    };
    expect(setEffect).toHaveBeenCalledWith(saved);
    expect(triggerSaveTheme).toHaveBeenCalledWith(
      "DARK",
      "#7c3aed",
      "#1e40af",
      "#a855f7",
      undefined,
      0.85,
      { fontId: "playfair", effect: saved }
    );
  });

  it("Font tab shows the font grid and live preview using event title", () => {
    const { getByText, queryByText } = renderPanel();
    fireEvent.click(getByText("Font"));
    expect(getByText("Theme default")).toBeTruthy();
    expect(getByText("Playfair Display")).toBeTruthy();
    expect(getByText("Summer Gala")).toBeTruthy();
    expect(getByText("Event title font")).toBeTruthy();
    expect(queryByText("Amount")).toBeNull();
    expect(queryByText("Customize colors")).toBeNull();
  });

  it("the Customize colors accordion no longer contains the font picker", () => {
    const { queryByText } = renderPanel({ themeCustomizeOpen: true });
    // Accordion is open on the Theme tab: colors are there, fonts are not
    expect(queryByText("Background colors")).toBeTruthy();
    expect(queryByText("Heading Font")).toBeNull();
    expect(queryByText("Theme default")).toBeNull();
  });
});

describe("event page font scope", () => {
  it("GuestSharingCard title keeps the base font instead of t.headingFont", () => {
    const t = { ...testTheme, headingFont: "'Test Heading Font', serif" };
    const event = {
      slug: "test-party",
      guestSharingEnabled: true,
      visibility: "PUBLIC",
    } as unknown as EventData;
    const { getByText } = render(
      <GuestSharingCard
        event={event}
        t={t}
        isHost={false}
        eventLinkCopied={false}
        setEventLinkCopied={noop}
        setShowShareQr={noop}
      />
    );
    const title = getByText("Share this event");
    expect(title.style.fontFamily).toBe("");
  });
});

describe("localized theme descriptors", () => {
  it("translates built-in labels and color tooltips without changing stable values", () => {
    const { getByTitle, getByText } = renderPanel({ themeCustomizeOpen: true }, "nl-NL");
    expect(getByText("Kleuren aanpassen")).toBeVisible();
    fireEvent.click(getByTitle("Paars"));
    expect(noop).toHaveBeenCalledWith("#a855f7");
    fireEvent.click(getByText("Effecten"));
    expect(getByText("Hoeveelheid")).toBeVisible();
    expect(getByText("Snelheid")).toBeVisible();
    expect(getByText("Harten")).toBeVisible();
    expect(getByText("Grootte")).toBeVisible();
    expect(getByText("Beweging")).toBeVisible();
    expect(getByText("Willekeurig")).toBeVisible();
    fireEvent.click(getByTitle("Harten"));
    expect(noop).toHaveBeenCalledWith({ ...CONFETTI, effectId: "hearts" });
  });
});
