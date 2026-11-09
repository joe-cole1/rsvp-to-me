"use client";

import { useTranslations } from "next-intl";

import { presetPresentation } from "@/lib/theme-preset-presentation";
import { PresetIcon } from "../PresetIcon";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  ACCENT_PRESETS,
  BASE_THEMES,
  getDefaultCardOpacity,
  type BaseTheme,
  type ResolvedTheme,
  MIN_CARD_OPACITY,
} from "@/lib/theme";
import { FONT_OPTIONS } from "@/lib/fonts";
import type { LibraryIconSummary } from "@/lib/effect-catalog-shared";
import type { DbThemePreset, EventInput, ThemeExtrasOverrides } from "./types";
import { effectStatesEqual, initialEffectState, type EffectEditorState } from "./effect-state";
import { EffectsPanel } from "./EffectsPanel";
import { Section } from "./ui";
import { Button } from "@/components/ui/Button";
import { Chip, ChoiceTile, CustomSwatch, Swatch } from "@/components/ui/Choice";
import { ColorInput, Input, Label, Range } from "@/components/ui/Field";

export function ThemePanel({
  event,
  themePresets,
  visibleThemePresets,
  themeSearch,
  setThemeSearch,
  themeFilter,
  setThemeFilter,
  themeCustomizeOpen,
  setThemeCustomizeOpen,
  base,
  setBase,
  gradientFrom,
  setGradientFrom,
  gradientTo,
  setGradientTo,
  accent,
  setAccent,
  cardOpacity,
  setCardOpacity,
  themePresetId,
  setThemePresetId,
  fontId,
  setFontId,
  effect,
  setEffect,
  libraryIcons,
  rememberLibraryIcons,
  triggerSaveTheme,
  t,
}: {
  event: EventInput;
  themePresets: DbThemePreset[];
  visibleThemePresets: DbThemePreset[];
  themeSearch: string;
  setThemeSearch: React.Dispatch<React.SetStateAction<string>>;
  themeFilter: "all" | "seasonal" | "occasion" | "general" | "light" | "dark";
  setThemeFilter: React.Dispatch<
    React.SetStateAction<"all" | "seasonal" | "occasion" | "general" | "light" | "dark">
  >;
  themeCustomizeOpen: boolean;
  setThemeCustomizeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  base: BaseTheme;
  setBase: React.Dispatch<React.SetStateAction<BaseTheme>>;
  gradientFrom: string;
  setGradientFrom: React.Dispatch<React.SetStateAction<string>>;
  gradientTo: string;
  setGradientTo: React.Dispatch<React.SetStateAction<string>>;
  accent: string;
  setAccent: React.Dispatch<React.SetStateAction<string>>;
  cardOpacity: number;
  setCardOpacity: React.Dispatch<React.SetStateAction<number>>;
  themePresetId: string | null;
  setThemePresetId: React.Dispatch<React.SetStateAction<string | null>>;
  fontId: string | null;
  setFontId: React.Dispatch<React.SetStateAction<string | null>>;
  effect: EffectEditorState;
  setEffect: React.Dispatch<React.SetStateAction<EffectEditorState>>;
  libraryIcons: Record<string, LibraryIconSummary>;
  rememberLibraryIcons: (icons: LibraryIconSummary[]) => void;
  triggerSaveTheme: (
    newBase: BaseTheme,
    newFrom: string,
    newTo: string,
    newAccent: string,
    presetId?: string | null,
    newCardOpacity?: number,
    extras?: ThemeExtrasOverrides
  ) => void;
  t: ResolvedTheme;
}) {
  const shared = useTranslations("Ui.Event.shared");
  const translate = useTranslations("Ui.Event.ThemePanel");

  // Sub-tab within the Theme section; purely visual, so plain local state (no URL sync)
  const [activeTab, setActiveTab] = useState<"theme" | "effects" | "font">("theme");
  const { confirm, dialog } = useConfirm(t);
  // One baseline for hosts: the applied preset's current settings. Selecting a
  // tile, the customization check and Restore all use it, so a freshly applied
  // preset never counts as customized. The administrator's default/original
  // snapshots are admin-only reset points.
  const appliedPreset = themePresetId
    ? (themePresets.find((p) => p.id === themePresetId) ?? null)
    : null;
  const customized =
    !!appliedPreset &&
    (base !== appliedPreset.base ||
      gradientFrom !== appliedPreset.gradientFrom ||
      gradientTo !== appliedPreset.gradientTo ||
      accent !== appliedPreset.accentColor ||
      cardOpacity !== (appliedPreset.cardOpacity ?? getDefaultCardOpacity(appliedPreset.base)) ||
      fontId !== (appliedPreset.fontId ?? null) ||
      !effectStatesEqual(
        effect,
        initialEffectState(presetPresentation(appliedPreset.presentation).effect)
      ));
  const applyPreset = async (p: DbThemePreset, mode: "apply" | "restore" = "apply") => {
    const confirmed =
      !customized ||
      (mode === "restore"
        ? await confirm({
            title: translate("restoreTitle", { name: p.name }),
            message: translate("restoreMessage"),
            confirmLabel: translate("restoreConfirm"),
            tone: "primary",
          })
        : await confirm({
            title: translate("replaceTitle"),
            message: translate("replaceMessage"),
            confirmLabel: translate("apply"),
            tone: "primary",
          }));
    if (!confirmed) return;
    const id = p.id;
    const opacity = p.cardOpacity ?? getDefaultCardOpacity(p.base);
    const nextEffect = initialEffectState(presetPresentation(p.presentation).effect);
    setBase(p.base);
    setGradientFrom(p.gradientFrom);
    setGradientTo(p.gradientTo);
    setAccent(p.accentColor);
    setCardOpacity(opacity);
    setFontId(p.fontId ?? null);
    setThemePresetId(id);
    setEffect(nextEffect);
    triggerSaveTheme(p.base, p.gradientFrom, p.gradientTo, p.accentColor, id, opacity, {
      fontId: p.fontId ?? null,
      effect: nextEffect,
    });
  };
  const hint: React.CSSProperties = {
    fontSize: "13px",
    lineHeight: "19px",
    color: t.textSecondary,
    margin: "0 0 8px",
  };
  return (
    <Section title={translate("theme")} t={t}>
      {dialog}
      {/* Sub-tabs: color presets / animated effects / event-title font */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
        {(
          [
            { id: "theme", label: translate("theme2") },
            { id: "effects", label: translate("effects") },
            { id: "font", label: translate("font") },
          ] as const
        ).map((tab) => (
          <Chip
            key={tab.id}
            theme={t}
            selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1 }}
          >
            {tab.label}
          </Chip>
        ))}
      </div>

      {activeTab === "theme" && (
        <>
          {/* Search */}
          <div style={{ marginBottom: "10px" }}>
            <Input
              theme={t}
              type="text"
              aria-label={translate("searchThemes")}
              value={themeSearch}
              onChange={(e) => setThemeSearch(e.target.value)}
              placeholder={translate("searchThemes")}
            />
          </div>

          {/* Filter pills + reset */}
          {(() => {
            const savedBase: BaseTheme = event.theme?.baseTheme ?? "DARK";
            const savedFrom = event.theme?.gradientFrom ?? "#7c3aed";
            const savedTo = event.theme?.gradientTo ?? "#1e40af";
            const savedAccent = event.theme?.accentColor ?? "#a855f7";
            const savedOpacity =
              event.theme?.cardOpacity ?? getDefaultCardOpacity(event.theme?.baseTheme);
            const savedFontId = event.theme?.fontId ?? null;
            const savedEffect = initialEffectState(event.theme);
            const hasChanged =
              base !== savedBase ||
              gradientFrom !== savedFrom ||
              gradientTo !== savedTo ||
              accent !== savedAccent ||
              cardOpacity !== savedOpacity ||
              fontId !== savedFontId ||
              !effectStatesEqual(effect, savedEffect);
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "8px",
                  }}
                >
                  {/* Scrolls sideways when it overflows; the padding keeps focus rings unclipped. */}
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flex: 1,
                      minWidth: 0,
                      overflowX: "auto",
                      padding: "3px",
                      margin: "-3px",
                    }}
                  >
                    {(["all", "seasonal", "occasion", "general", "light", "dark"] as const).map(
                      (f) => (
                        <Chip
                          key={f}
                          theme={t}
                          selected={themeFilter === f}
                          onClick={() => setThemeFilter(f)}
                        >
                          {f === "occasion"
                            ? translate("occasions")
                            : f === "all"
                              ? translate("all")
                              : f === "seasonal"
                                ? translate("seasonal")
                                : f === "general"
                                  ? translate("general")
                                  : f === "light"
                                    ? translate("light")
                                    : translate("dark")}
                        </Chip>
                      )
                    )}
                  </div>
                  {hasChanged && (
                    <Button
                      theme={t}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setBase(savedBase);
                        setGradientFrom(savedFrom);
                        setGradientTo(savedTo);
                        setAccent(savedAccent);
                        setCardOpacity(savedOpacity);
                        setFontId(savedFontId);
                        setEffect(savedEffect);
                        triggerSaveTheme(
                          savedBase,
                          savedFrom,
                          savedTo,
                          savedAccent,
                          undefined,
                          savedOpacity,
                          { fontId: savedFontId, effect: savedEffect }
                        );
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      {translate("reset")}
                    </Button>
                  )}
                </div>
                {customized && appliedPreset && (
                  <Button
                    theme={t}
                    variant="secondary"
                    fullWidth
                    type="button"
                    onClick={() => void applyPreset(appliedPreset, "restore")}
                    style={{ marginBottom: "8px" }}
                  >
                    {translate("restorePreset", { name: appliedPreset.name })}
                  </Button>
                )}
              </>
            );
          })()}

          {/* Preset grid: grows with the page, no scrolling box inside it */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: "8px",
              marginBottom: "14px",
            }}
          >
            {visibleThemePresets.map((p) => {
              const isActive =
                base === p.base &&
                gradientFrom === p.gradientFrom &&
                gradientTo === p.gradientTo &&
                accent === p.accentColor;
              return (
                <ChoiceTile
                  key={p.id}
                  theme={t}
                  selected={isActive}
                  onClick={() => void applyPreset(p)}
                  style={{ padding: 0, gap: 0, overflow: "hidden", alignItems: "stretch" }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      height: "36px",
                      background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                    }}
                  >
                    <span
                      style={{ position: "absolute", top: "3px", left: "4px", fontSize: "12px" }}
                    >
                      <PresetIcon id={presetPresentation(p.presentation).tileIconId} size={18} />
                    </span>
                    <div
                      style={{
                        position: "absolute",
                        bottom: "3px",
                        right: "4px",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: p.accentColor,
                        border: "1px solid rgba(255,255,255,0.3)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      padding: "5px 6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </div>
                </ChoiceTile>
              );
            })}
            {visibleThemePresets.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "20px",
                  color: t.textSecondary,
                  fontSize: "13px",
                }}
              >
                {translate("noThemesMatch")}
              </div>
            )}
          </div>

          {/* Customize accordion */}
          <div
            style={{
              marginBottom: "12px",
              border: `1px solid ${t.inputBorder}`,
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              aria-expanded={themeCustomizeOpen}
              onClick={() => setThemeCustomizeOpen((o) => !o)}
              className="rsvp-control rsvp-press"
              style={
                {
                  "--rsvp-focus": t.accent,
                  "--rsvp-hover": "rgba(127,127,127,0.08)",
                  width: "100%",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  backgroundColor: t.inputBg,
                  border: "none",
                  cursor: "pointer",
                  color: t.textPrimary,
                  fontFamily: "inherit",
                  fontSize: "14px",
                  fontWeight: 600,
                } as React.CSSProperties
              }
            >
              <span>{translate("customizeColors")}</span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                style={{
                  color: t.textSecondary,
                  transform: themeCustomizeOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
            </button>

            {themeCustomizeOpen && (
              <div style={{ padding: "14px", borderTop: `1px solid ${t.inputBorder}` }}>
                {/* Style selector */}
                <div style={{ marginBottom: "14px" }}>
                  <Label theme={t}>{translate("style")}</Label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {BASE_THEMES.map((bt) => (
                      <ChoiceTile
                        key={bt.id}
                        theme={t}
                        selected={base === bt.id}
                        onClick={() => {
                          const newFrom = bt.defaultGradientFrom;
                          const newTo = bt.defaultGradientTo;
                          const newAccent = bt.defaultAccent;
                          setBase(bt.id);
                          setGradientFrom(newFrom);
                          setGradientTo(newTo);
                          setAccent(newAccent);
                          triggerSaveTheme(bt.id, newFrom, newTo, newAccent);
                        }}
                        style={{ flex: 1, padding: 0, gap: 0, overflow: "hidden" }}
                      >
                        <div
                          aria-hidden="true"
                          style={{ height: "36px", width: "100%", background: bt.preview }}
                        />
                        <div style={{ padding: "6px 4px", fontSize: "12px", fontWeight: 600 }}>
                          {shared("baseThemes." + bt.id)}
                        </div>
                      </ChoiceTile>
                    ))}
                  </div>
                </div>

                {/* Background colors */}
                <div style={{ marginBottom: "14px" }}>
                  <Label theme={t}>{translate("backgroundColors")}</Label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...hint, margin: "0 0 6px" }}>{translate("start")}</div>
                      <ColorInput
                        theme={t}
                        label={`${translate("backgroundColors")}: ${translate("start")}`}
                        value={gradientFrom}
                        onChange={(value) => {
                          setGradientFrom(value);
                          triggerSaveTheme(base, value, gradientTo, accent);
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...hint, margin: "0 0 6px" }}>{translate("end")}</div>
                      <ColorInput
                        theme={t}
                        label={`${translate("backgroundColors")}: ${translate("end")}`}
                        value={gradientTo}
                        onChange={(value) => {
                          setGradientTo(value);
                          triggerSaveTheme(base, gradientFrom, value, accent);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Accent color */}
                <Label theme={t}>{translate("accentColor")}</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {ACCENT_PRESETS.map((p) => (
                    <Swatch
                      key={p.value}
                      theme={t}
                      color={p.value}
                      label={shared("accents." + p.name)}
                      selected={accent === p.value}
                      onClick={() => {
                        setAccent(p.value);
                        triggerSaveTheme(base, gradientFrom, gradientTo, p.value);
                      }}
                    />
                  ))}
                  <CustomSwatch
                    theme={t}
                    label={translate("accentColor")}
                    value={accent}
                    selected={!ACCENT_PRESETS.some((p) => p.value === accent)}
                    onChange={(value) => {
                      setAccent(value);
                      triggerSaveTheme(base, gradientFrom, gradientTo, value);
                    }}
                  />
                </div>

                {/* Card opacity */}
                <div style={{ marginTop: "14px" }}>
                  <Label theme={t} htmlFor="theme-card-opacity">
                    {translate("cardOpacity")}
                  </Label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Range
                      theme={t}
                      id="theme-card-opacity"
                      min={MIN_CARD_OPACITY}
                      max={1}
                      step={0.05}
                      value={cardOpacity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCardOpacity(val);
                      }}
                      onMouseUp={(e) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        triggerSaveTheme(base, gradientFrom, gradientTo, accent, undefined, val);
                      }}
                      onTouchEnd={(e) => {
                        const val = parseFloat((e.target as HTMLInputElement).value);
                        triggerSaveTheme(base, gradientFrom, gradientTo, accent, undefined, val);
                      }}
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: t.textSecondary,
                        minWidth: "40px",
                        textAlign: "right",
                      }}
                    >
                      {Math.round(cardOpacity * 100)}%
                    </span>
                  </div>
                  <div style={{ ...hint, margin: "4px 0 0" }}>
                    {cardOpacity < 0.65
                      ? translate("veryFrostedBoldGradientShowsThrough")
                      : cardOpacity > 0.92
                        ? translate("nearSolidCards")
                        : translate("balancedTransparency")}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Effect (animated background) ── */}
      {activeTab === "effects" && (
        <EffectsPanel
          eventId={event.id}
          t={t}
          effect={effect}
          libraryIcons={libraryIcons}
          onPreview={setEffect}
          onCommit={(next, icons) => {
            if (icons?.length) rememberLibraryIcons(icons);
            setEffect(next);
            triggerSaveTheme(base, gradientFrom, gradientTo, accent, undefined, undefined, {
              effect: next,
            });
          }}
        />
      )}

      {/* ── Event title font ── */}
      {activeTab === "font" && (
        <div style={{ marginBottom: "12px" }}>
          <Label theme={t}>{translate("eventTitleFont")}</Label>
          <p style={hint}>{translate("appliedOnlyMainEventTitleSome")}</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
              gap: "8px",
            }}
          >
            <ChoiceTile
              theme={t}
              selected={fontId === null}
              onClick={() => {
                setFontId(null);
                triggerSaveTheme(base, gradientFrom, gradientTo, accent, undefined, undefined, {
                  fontId: null,
                });
              }}
            >
              {translate("themeDefault")}
            </ChoiceTile>
            {FONT_OPTIONS.map((f) => (
              <ChoiceTile
                key={f.id}
                theme={t}
                selected={fontId === f.id}
                onClick={() => {
                  setFontId(f.id);
                  triggerSaveTheme(base, gradientFrom, gradientTo, accent, undefined, undefined, {
                    fontId: f.id,
                  });
                }}
                title={f.label}
                style={{ fontSize: "14px", fontFamily: `var(${f.cssVar}), ${f.fallback}` }}
              >
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {f.label}
                </span>
              </ChoiceTile>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              padding: "16px 12px",
              borderRadius: "10px",
              background: t.inputBg,
              border: `1px solid ${t.inputBorder}`,
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <h1
              style={{
                fontSize: "28px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                fontFamily: t.headingFont,
                color: t.heroText ?? t.textPrimary,
                textShadow: t.heroTextShadow,
                margin: 0,
                textAlign: "center",
                wordBreak: "break-word",
              }}
            >
              {event.title || translate("reInvited")}
            </h1>
          </div>
        </div>
      )}
    </Section>
  );
}
