// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { ThemePanel } from "@/components/event/settings-page/ThemePanel";
import { GuestSharingCard } from "@/components/event/event-page/GuestSharingCard";
import { testTheme } from "./helpers/theme";
import type { EventInput } from "@/components/event/settings-page/types";
import type { EventData } from "@/components/event/event-page/types";

const noop = vi.fn();

function renderPanel(overrides: Partial<React.ComponentProps<typeof ThemePanel>> = {}) {
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
    />
  );
}

describe("ThemePanel tabs", () => {
  it("defaults to the Theme tab: presets + customize, no effect or font controls", () => {
    const { container, queryByText, getByPlaceholderText } = renderPanel();
    expect(getByPlaceholderText("Search themes…")).toBeTruthy();
    expect(queryByText("Customize colors")).toBeTruthy();
    expect(queryByText("Density")).toBeNull();
    expect(queryByText("Theme default")).toBeNull();
    expect(container.querySelector('input[type="range"]')).toBeNull();
  });

  it("Effects tab shows the picker with Density, Speed, and Size each on its own row", () => {
    const { container, getByText, queryByPlaceholderText } = renderPanel();
    fireEvent.click(getByText("✨ Effects"));
    expect(queryByPlaceholderText("Search themes…")).toBeNull();
    expect(getByText("None")).toBeTruthy();
    // The three controls are stacked in a dedicated column container
    const density = getByText("Density");
    const speed = getByText("Speed");
    const size = getByText("Size");
    const column = density.parentElement!.parentElement as HTMLElement;
    expect(column.style.flexDirection).toBe("column");
    expect(speed.parentElement!.parentElement).toBe(column);
    expect(size.parentElement!.parentElement).toBe(column);
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("10");
  });

  it("Font tab shows the font grid and live preview using event title", () => {
    const { getByText, queryByText } = renderPanel();
    fireEvent.click(getByText("🔤 Font"));
    expect(getByText("Theme default")).toBeTruthy();
    expect(getByText("Playfair Display")).toBeTruthy();
    expect(getByText("Summer Gala")).toBeTruthy();
    expect(getByText("Event Title Font")).toBeTruthy();
    expect(queryByText("Density")).toBeNull();
    expect(queryByText("Customize colors")).toBeNull();
  });

  it("the Customize colors accordion no longer contains the font picker", () => {
    const { queryByText } = renderPanel({ themeCustomizeOpen: true });
    // Accordion is open on the Theme tab: colors are there, fonts are not
    expect(queryByText("Background Colors")).toBeTruthy();
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
