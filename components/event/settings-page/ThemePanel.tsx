"use client";

import { Check } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme, type ResolvedTheme } from "@/lib/theme";
import type { DbThemePreset, EventInput, ThemeSnapObj } from "./types";
import { Label, Section } from "./ui";

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
  triggerSaveTheme,
  t,
}: {
  event: EventInput;
  themePresets: DbThemePreset[];
  visibleThemePresets: DbThemePreset[];
  themeSearch: string;
  setThemeSearch: React.Dispatch<React.SetStateAction<string>>;
  themeFilter: "all" | "seasonal" | "general" | "light" | "dark";
  setThemeFilter: React.Dispatch<
    React.SetStateAction<"all" | "seasonal" | "general" | "light" | "dark">
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
  triggerSaveTheme: (
    newBase: BaseTheme,
    newFrom: string,
    newTo: string,
    newAccent: string,
    presetId?: string | null,
    newCardOpacity?: number
  ) => void;
  t: ResolvedTheme;
}) {
  return (
    <Section title="Theme" t={t}>
      {/* Search */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          value={themeSearch}
          onChange={(e) => setThemeSearch(e.target.value)}
          placeholder="Search themes…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 12px",
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            borderRadius: "10px",
            color: t.textPrimary,
            fontSize: "13px",
            outline: "none",
          }}
        />
      </div>

      {/* Filter pills + reset */}
      {(() => {
        const savedBase: BaseTheme = event.theme?.baseTheme ?? "DARK";
        const savedFrom = event.theme?.gradientFrom ?? "#7c3aed";
        const savedTo = event.theme?.gradientTo ?? "#1e40af";
        const savedAccent = event.theme?.accentColor ?? "#a855f7";
        const savedOpacity =
          event.theme?.cardOpacity ??
          (event.theme?.baseTheme === "DARK"
            ? 0.5
            : event.theme?.baseTheme === "SOFT"
              ? 0.85
              : 0.8);
        const hasChanged =
          base !== savedBase ||
          gradientFrom !== savedFrom ||
          gradientTo !== savedTo ||
          accent !== savedAccent ||
          cardOpacity !== savedOpacity;
        const appliedPreset = themePresetId
          ? themePresets.find((p) => p.id === themePresetId)
          : null;
        const presetDefault = (appliedPreset?.defaultSnapshot as ThemeSnapObj | null) ?? null;
        const divergedFromPreset =
          presetDefault &&
          (base !== presetDefault.base ||
            gradientFrom !== presetDefault.gradientFrom ||
            gradientTo !== presetDefault.gradientTo ||
            accent !== presetDefault.accentColor ||
            (presetDefault.cardOpacity != null && cardOpacity !== presetDefault.cardOpacity));
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
              <div style={{ display: "flex", gap: "6px", flex: 1, overflowX: "auto" }}>
                {(["all", "seasonal", "general", "light", "dark"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setThemeFilter(f)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      border: `1px solid ${themeFilter === f ? t.accent : t.inputBorder}`,
                      background: themeFilter === f ? t.accentBg : "transparent",
                      color: themeFilter === f ? t.accent : t.textMuted,
                    }}
                  >
                    {f === "all"
                      ? "All"
                      : f === "seasonal"
                        ? "🎉 Seasonal"
                        : f === "general"
                          ? "🎨 General"
                          : f === "light"
                            ? "☀️ Light"
                            : "🌙 Dark"}
                  </button>
                ))}
              </div>
              {hasChanged && (
                <button
                  onClick={() => {
                    setBase(savedBase);
                    setGradientFrom(savedFrom);
                    setGradientTo(savedTo);
                    setAccent(savedAccent);
                    setCardOpacity(savedOpacity);
                    triggerSaveTheme(
                      savedBase,
                      savedFrom,
                      savedTo,
                      savedAccent,
                      undefined,
                      savedOpacity
                    );
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    border: `1px solid ${t.inputBorder}`,
                    background: "transparent",
                    color: t.textMuted,
                  }}
                >
                  ↺ Reset
                </button>
              )}
            </div>
            {divergedFromPreset && presetDefault && appliedPreset && (
              <button
                type="button"
                onClick={() => {
                  const defaultOpacity =
                    presetDefault.cardOpacity ??
                    (presetDefault.base === "DARK"
                      ? 0.5
                      : presetDefault.base === "SOFT"
                        ? 0.85
                        : 0.8);
                  setBase(presetDefault.base);
                  setGradientFrom(presetDefault.gradientFrom);
                  setGradientTo(presetDefault.gradientTo);
                  setAccent(presetDefault.accentColor);
                  setCardOpacity(defaultOpacity);
                  triggerSaveTheme(
                    presetDefault.base,
                    presetDefault.gradientFrom,
                    presetDefault.gradientTo,
                    presetDefault.accentColor,
                    themePresetId,
                    defaultOpacity
                  );
                }}
                style={{
                  width: "100%",
                  marginBottom: "8px",
                  padding: "8px 12px",
                  background: "transparent",
                  border: `1px solid ${t.accentBorder}`,
                  borderRadius: "10px",
                  color: t.accent,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                ↺ Restore to &ldquo;{appliedPreset.name}&rdquo; defaults
              </button>
            )}
          </>
        );
      })()}

      {/* Preset grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
          gap: "7px",
          maxHeight: "300px",
          overflowY: "auto",
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
            <button
              key={p.id}
              onClick={() => {
                const defaultOpacity =
                  p.cardOpacity ?? (p.base === "DARK" ? 0.5 : p.base === "SOFT" ? 0.85 : 0.8);
                setBase(p.base);
                setGradientFrom(p.gradientFrom);
                setGradientTo(p.gradientTo);
                setAccent(p.accentColor);
                setCardOpacity(defaultOpacity);
                setThemePresetId(p.id);
                triggerSaveTheme(
                  p.base,
                  p.gradientFrom,
                  p.gradientTo,
                  p.accentColor,
                  p.id,
                  defaultOpacity
                );
              }}
              style={{
                padding: 0,
                border: `2px solid ${isActive ? t.accent : t.inputBorder}`,
                borderRadius: "10px",
                cursor: "pointer",
                background: isActive ? t.accentBg : t.inputBg,
                transition: "all 0.15s",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: "36px",
                  background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})`,
                }}
              >
                <span style={{ position: "absolute", top: "3px", left: "4px", fontSize: "10px" }}>
                  {p.emoji}
                </span>
                <div
                  style={{
                    position: "absolute",
                    bottom: "3px",
                    right: "4px",
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: p.accentColor,
                    border: "1px solid rgba(255,255,255,0.3)",
                  }}
                />
              </div>
              <div
                style={{
                  padding: "4px 5px",
                  fontSize: "9px",
                  fontWeight: 600,
                  color: t.textSecondary,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </div>
            </button>
          );
        })}
        {visibleThemePresets.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "20px",
              color: t.textMuted,
              fontSize: "12px",
            }}
          >
            No themes match
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
          onClick={() => setThemeCustomizeOpen((o) => !o)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: t.inputBg,
            border: "none",
            cursor: "pointer",
            color: t.textPrimary,
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <span>Customize colors</span>
          <span
            style={{
              fontSize: "11px",
              color: t.textMuted,
              transform: themeCustomizeOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            ▼
          </span>
        </button>

        {themeCustomizeOpen && (
          <div style={{ padding: "14px", borderTop: `1px solid ${t.inputBorder}` }}>
            {/* Style selector */}
            <div style={{ marginBottom: "14px" }}>
              <Label t={t}>Style</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                {BASE_THEMES.map((bt) => (
                  <button
                    key={bt.id}
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
                    style={{
                      flex: 1,
                      padding: 0,
                      border: `2px solid ${base === bt.id ? t.textPrimary : t.inputBorder}`,
                      borderRadius: "12px",
                      cursor: "pointer",
                      overflow: "hidden",
                      background: "none",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ height: "36px", background: bt.preview }} />
                    <div
                      style={{
                        padding: "5px 4px",
                        color: t.textPrimary,
                        fontSize: "10px",
                        fontWeight: 600,
                        background: t.inputBg,
                      }}
                    >
                      {bt.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Background colors */}
            <div style={{ marginBottom: "14px" }}>
              <Label t={t}>Background Colors</Label>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: t.textMuted, marginBottom: "5px" }}>
                    Start
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 10px",
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: "9px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "5px",
                        background: gradientFrom,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: t.textSecondary,
                        fontFamily: "monospace",
                      }}
                    >
                      {gradientFrom}
                    </span>
                    <input
                      type="color"
                      value={gradientFrom}
                      onChange={(e) => {
                        setGradientFrom(e.target.value);
                        triggerSaveTheme(base, e.target.value, gradientTo, accent);
                      }}
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                    />
                  </label>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: t.textMuted, marginBottom: "5px" }}>
                    End
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "7px 10px",
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: "9px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "5px",
                        background: gradientTo,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: t.textSecondary,
                        fontFamily: "monospace",
                      }}
                    >
                      {gradientTo}
                    </span>
                    <input
                      type="color"
                      value={gradientTo}
                      onChange={(e) => {
                        setGradientTo(e.target.value);
                        triggerSaveTheme(base, gradientFrom, e.target.value, accent);
                      }}
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Accent color */}
            <Label t={t}>Accent Color</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    setAccent(p.value);
                    triggerSaveTheme(base, gradientFrom, gradientTo, p.value);
                  }}
                  title={p.name}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: p.value,
                    border: `3px solid ${accent === p.value ? t.textPrimary : "transparent"}`,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {accent === p.value && <Check size={12} color={t.accentFg} strokeWidth={3} />}
                </button>
              ))}
              <label
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  border: `3px solid ${!ACCENT_PRESETS.some((p) => p.value === accent) ? t.textPrimary : "transparent"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  background: ACCENT_PRESETS.some((p) => p.value === accent) ? t.inputBg : accent,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                🎨
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => {
                    setAccent(e.target.value);
                    triggerSaveTheme(base, gradientFrom, gradientTo, e.target.value);
                  }}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </label>
            </div>

            {/* Card opacity */}
            <div style={{ marginTop: "14px" }}>
              <Label t={t}>Card Opacity</Label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="range"
                  min={0.4}
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
                  style={{ flex: 1, accentColor: t.accent }}
                />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: t.textSecondary,
                    minWidth: "36px",
                    textAlign: "right",
                  }}
                >
                  {Math.round(cardOpacity * 100)}%
                </span>
              </div>
              <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "4px" }}>
                {cardOpacity < 0.65
                  ? "Very frosted — bold gradient shows through"
                  : cardOpacity > 0.92
                    ? "Near-solid cards"
                    : "Balanced transparency"}
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
