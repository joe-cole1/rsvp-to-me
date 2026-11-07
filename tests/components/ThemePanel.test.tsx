// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@/tests/components/render";
import React from "react";
import { ThemePanel } from "@/components/event/settings-page/ThemePanel";
import { GuestSharingCard } from "@/components/event/event-page/GuestSharingCard";
import english from "@/messages/en-US.json";
import dutch from "@/messages/nl-NL.json";
import { testTheme } from "./helpers/theme";
import type { EventInput } from "@/components/event/settings-page/types";
import type { EventData } from "@/components/event/event-page/types";

const noop = vi.fn();

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
      effectId="confetti"
      setEffectId={noop}
      effectDensity="medium"
      setEffectDensity={noop}
      effectSpeed="medium"
      setEffectSpeed={noop}
      effectSize={1}
      setEffectSize={noop}
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

  it("Effects tab shows the picker with Amount and Speed each on its own row, and no size slider", () => {
    const { container, getByText, queryByText, queryByPlaceholderText } = renderPanel();
    fireEvent.click(getByText("Effects"));
    expect(queryByPlaceholderText("Search themes…")).toBeNull();
    expect(getByText("None")).toBeTruthy();
    // The two controls are stacked in a dedicated column container
    const amount = getByText("Amount");
    const speed = getByText("Speed");
    const column = amount.parentElement!.parentElement as HTMLElement;
    expect(column.style.flexDirection).toBe("column");
    expect(speed.parentElement!.parentElement).toBe(column);
    expect(queryByText("Density")).toBeNull();
    expect(queryByText("Size")).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("an Amount step saves density and size together", () => {
    const setEffectDensity = vi.fn();
    const setEffectSize = vi.fn();
    const triggerSaveTheme = vi.fn();
    const { getByText, getByRole } = renderPanel({
      setEffectDensity,
      setEffectSize,
      triggerSaveTheme,
    });
    fireEvent.click(getByText("Effects"));
    expect(getByRole("button", { name: "Some" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "More" }));
    expect(setEffectDensity).toHaveBeenCalledWith("dense");
    expect(setEffectSize).toHaveBeenCalledWith(2);
    expect(triggerSaveTheme).toHaveBeenCalledWith(
      "DARK",
      "#7c3aed",
      "#1e40af",
      "#a855f7",
      undefined,
      undefined,
      { effectDensity: "dense", effectSize: 2 }
    );
  });

  it("an older event reads as the Amount step its density maps to", () => {
    const { getByText, getByRole } = renderPanel({ effectDensity: "sparse", effectSize: 6 });
    fireEvent.click(getByText("Effects"));
    expect(getByRole("button", { name: "Less" })).toHaveAttribute("aria-pressed", "true");
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
    fireEvent.click(getByTitle("Harten"));
    expect(noop).toHaveBeenCalledWith("hearts");
  });
});
