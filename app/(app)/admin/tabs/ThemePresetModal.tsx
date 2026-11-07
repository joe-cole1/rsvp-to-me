"use client";
import { useTranslations } from "next-intl";

import { X } from "lucide-react";
import {
  APP_SHELL,
  APP_SHELL_THEME as T,
  BASE_THEMES,
  ACCENT_PRESETS,
  getDefaultCardOpacity,
  resolveTheme,
  MIN_CARD_OPACITY,
} from "@/lib/theme";
import { FONT_OPTIONS, getFontById } from "@/lib/fonts";
import type { AdminThemePreset, ThemePresetFormState, ThemeSnapObj } from "./types";
import { Dialog } from "@/components/ui/Dialog";
import { Button, buttonProps, buttonStyle } from "@/components/ui/Button";
import { ChoiceTile, CustomSwatch, Swatch } from "@/components/ui/Choice";
import { Check, ColorInput, Field, Input, Label, Range, Select } from "@/components/ui/Field";

type ComparableThemePreset = Pick<
  ThemePresetFormState,
  | "name"
  | "emoji"
  | "base"
  | "gradientFrom"
  | "gradientTo"
  | "accentColor"
  | "seasonal"
  | "month"
  | "cardOpacity"
  | "fontId"
>;

function themePresetDiffers(left: ComparableThemePreset, right: ComparableThemePreset) {
  return (
    left.name !== right.name ||
    left.emoji !== right.emoji ||
    left.base !== right.base ||
    left.gradientFrom !== right.gradientFrom ||
    left.gradientTo !== right.gradientTo ||
    left.accentColor !== right.accentColor ||
    left.seasonal !== right.seasonal ||
    (left.month ?? null) !== (right.month ?? null) ||
    (left.cardOpacity ?? null) !== (right.cardOpacity ?? null) ||
    (left.fontId ?? null) !== (right.fontId ?? null)
  );
}

export function ThemePresetModal({
  themePresetForm,
  setThemePresetForm,
  themePresetOriginal,
  themePresets,
  isSavingPreset,
  handleSaveThemePreset,
  handleSaveThemePresetAsDefault,
}: {
  themePresetForm: ThemePresetFormState | null;
  setThemePresetForm: React.Dispatch<React.SetStateAction<ThemePresetFormState | null>>;
  themePresetOriginal: ThemePresetFormState | null;
  themePresets: AdminThemePreset[];
  isSavingPreset: boolean;
  handleSaveThemePreset: (e: React.FormEvent) => Promise<void>;
  handleSaveThemePresetAsDefault: () => Promise<void>;
}) {
  const tr = useTranslations("Ui.Admin");
  const tEvent = useTranslations("Ui.Event");
  const common = useTranslations("Ui.Common");

  return (
    <Dialog
      open={themePresetForm !== null}
      onClose={() => setThemePresetForm(null)}
      titleId="theme-preset-dialog-title"
      panelStyle={{
        maxWidth: "500px",
        backgroundColor: "#16161e",
        border: `1px solid ${APP_SHELL.cardBorder}`,
        borderRadius: "20px",
        padding: "28px 24px 24px",
        color: APP_SHELL.textPrimary,
      }}
    >
      {themePresetForm && (
        <>
          {(() => {
            const editingPreset = themePresetForm.id
              ? themePresets.find((p) => p.id === themePresetForm.id)
              : null;
            const defSnap = (editingPreset?.defaultSnapshot as ThemeSnapObj | null) ?? null;
            const origSnap = (editingPreset?.originalSnapshot as ThemeSnapObj | null) ?? null;
            const formDiffersFromDefault = defSnap && themePresetDiffers(themePresetForm, defSnap);
            const origDiffersFromDefault =
              origSnap && defSnap && themePresetDiffers(origSnap, defSnap);
            const formDiffersFromOriginal =
              origSnap && themePresetDiffers(themePresetForm, origSnap);
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <h3
                  id="theme-preset-dialog-title"
                  style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: 700,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {themePresetForm.id ? tr("editPreset") : tr("newPreset2")}
                </h3>
                {formDiffersFromDefault && defSnap && (
                  <Button
                    theme={T}
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setThemePresetForm((f) => f && { ...f, ...defSnap })}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {tr("resetToDefault")}
                  </Button>
                )}
                {origDiffersFromDefault && formDiffersFromOriginal && origSnap && (
                  <Button
                    theme={T}
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setThemePresetForm((f) => f && { ...f, ...origSnap })}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {tr("resetToOriginal")}
                  </Button>
                )}
                <Button
                  theme={T}
                  variant="icon"
                  type="button"
                  aria-label={common("close")}
                  onClick={() => setThemePresetForm(null)}
                >
                  <X size={20} aria-hidden="true" />
                </Button>
              </div>
            );
          })()}

          <form
            onSubmit={handleSaveThemePreset}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Name + emoji row */}
            <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "10px" }}>
              <Field theme={T} label={tr("emoji")} style={{ marginBottom: 0 }}>
                <Input
                  theme={T}
                  type="text"
                  value={themePresetForm.emoji}
                  onChange={(e) => setThemePresetForm((f) => f && { ...f, emoji: e.target.value })}
                  maxLength={2}
                  style={{ textAlign: "center", padding: "10px 6px" }}
                />
              </Field>
              <Field theme={T} label={tr("name")} style={{ marginBottom: 0 }}>
                <Input
                  theme={T}
                  type="text"
                  value={themePresetForm.name}
                  onChange={(e) => setThemePresetForm((f) => f && { ...f, name: e.target.value })}
                  required
                  placeholder={tr("eGMidnightPurple")}
                />
              </Field>
            </div>

            {/* Base style */}
            <div>
              <Label theme={T}>{tr("baseStyle")}</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                {BASE_THEMES.map((bt) => (
                  <ChoiceTile
                    key={bt.id}
                    theme={T}
                    selected={themePresetForm.base === bt.id}
                    onClick={() => setThemePresetForm((f) => f && { ...f, base: bt.id })}
                    style={{ flex: 1, padding: 0, gap: 0, overflow: "hidden" }}
                  >
                    <div style={{ height: "36px", width: "100%", background: bt.preview }} />
                    <div style={{ padding: "6px 4px", fontSize: "12px", fontWeight: 600 }}>
                      {tEvent("shared.baseThemes." + bt.id)}
                    </div>
                  </ChoiceTile>
                ))}
              </div>
            </div>

            {/* Gradient colors */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label theme={T} style={{ marginBottom: "2px" }}>
                {tr("backgroundGradient")}
              </Label>
              <div style={{ display: "flex", gap: "10px" }}>
                <ColorInput
                  theme={T}
                  label={`${tr("backgroundGradient")} 1`}
                  value={themePresetForm.gradientFrom}
                  onChange={(value) =>
                    setThemePresetForm((f) => f && { ...f, gradientFrom: value })
                  }
                  style={{ flex: 1 }}
                />
                <ColorInput
                  theme={T}
                  label={`${tr("backgroundGradient")} 2`}
                  value={themePresetForm.gradientTo}
                  onChange={(value) => setThemePresetForm((f) => f && { ...f, gradientTo: value })}
                  style={{ flex: 1 }}
                />
              </div>
              <div
                style={{
                  height: "28px",
                  borderRadius: "6px",
                  background: `linear-gradient(135deg, ${themePresetForm.gradientFrom}, ${themePresetForm.gradientTo})`,
                  border: `1px solid ${APP_SHELL.cardBorder}`,
                }}
              />
            </div>

            {/* Accent color */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Label theme={T} style={{ marginBottom: "2px" }}>
                {tr("accentColor")}
              </Label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginBottom: "4px",
                }}
              >
                {ACCENT_PRESETS.map((p) => (
                  <Swatch
                    key={p.value}
                    theme={T}
                    color={p.value}
                    label={p.name}
                    selected={themePresetForm.accentColor === p.value}
                    onClick={() => setThemePresetForm((f) => f && { ...f, accentColor: p.value })}
                  />
                ))}
                <CustomSwatch
                  theme={T}
                  label={tr("custom")}
                  value={themePresetForm.accentColor}
                  selected={!ACCENT_PRESETS.some((p) => p.value === themePresetForm.accentColor)}
                  onChange={(value) => setThemePresetForm((f) => f && { ...f, accentColor: value })}
                />
              </div>
            </div>

            {/* Seasonal toggle + month */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: APP_SHELL.textPrimary,
                }}
              >
                <Check
                  theme={T}
                  checked={themePresetForm.seasonal}
                  onChange={(e) =>
                    setThemePresetForm(
                      (f) =>
                        f && {
                          ...f,
                          seasonal: e.target.checked,
                          month: e.target.checked ? f.month : null,
                        }
                    )
                  }
                />
                {tr("seasonalPreset")}
              </label>
              {themePresetForm.seasonal && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Label theme={T} htmlFor="theme-preset-month" style={{ marginBottom: 0 }}>
                    {tr("month112")}
                  </Label>
                  <Input
                    theme={T}
                    id="theme-preset-month"
                    type="number"
                    min={1}
                    max={12}
                    value={themePresetForm.month ?? ""}
                    onChange={(e) =>
                      setThemePresetForm(
                        (f) =>
                          f && {
                            ...f,
                            month: e.target.value ? parseInt(e.target.value, 10) : null,
                          }
                      )
                    }
                    placeholder={tr("eG10")}
                    style={{ width: "80px" }}
                  />
                </div>
              )}
            </div>

            {/* Heading font */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Field theme={T} label={tr("headingFont")} style={{ marginBottom: 0 }}>
                <Select
                  theme={T}
                  value={themePresetForm.fontId ?? ""}
                  onChange={(e) =>
                    setThemePresetForm((f) => f && { ...f, fontId: e.target.value || null })
                  }
                >
                  <option value="">{tr("themeDefault")}</option>
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {tEvent("shared.fonts." + f.id)} ({tr("fontCategory." + f.category)})
                    </option>
                  ))}
                </Select>
              </Field>
              {themePresetForm.fontId && (
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: "10px",
                    backgroundColor: T.inputBg,
                    border: `1px solid ${T.inputBorder}`,
                    color: T.textPrimary,
                    fontFamily: (() => {
                      const f = getFontById(themePresetForm.fontId);
                      return f ? `var(${f.cssVar}), ${f.fallback}` : "inherit";
                    })(),
                    fontSize: "18px",
                    textAlign: "center",
                  }}
                >
                  {tr("youRsquoReInvited")}
                </div>
              )}
            </div>

            {/* Card opacity */}
            {(() => {
              const defaultOp = getDefaultCardOpacity(themePresetForm.base);
              const currentOp = themePresetForm.cardOpacity ?? defaultOp;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <Label theme={T} htmlFor="theme-preset-opacity" style={{ marginBottom: "2px" }}>
                    {tr("cardOpacity")}
                  </Label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Range
                      theme={T}
                      id="theme-preset-opacity"
                      min={MIN_CARD_OPACITY}
                      max={1}
                      step={0.05}
                      value={currentOp}
                      onChange={(e) =>
                        setThemePresetForm(
                          (f) => f && { ...f, cardOpacity: parseFloat(e.target.value) }
                        )
                      }
                    />
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: APP_SHELL.textPrimary,
                        minWidth: "40px",
                        textAlign: "right",
                      }}
                    >
                      {Math.round(currentOp * 100)}%
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: T.textSecondary }}>
                    {tr("controlsCardTransparencyDefaultFor")}
                    {themePresetForm.base}: {Math.round(defaultOp * 100)}%
                  </div>
                </div>
              );
            })()}

            {/* Live theme preview */}
            {(() => {
              const pv = resolveTheme(
                themePresetForm.base,
                themePresetForm.gradientFrom,
                themePresetForm.gradientTo,
                themePresetForm.accentColor,
                themePresetForm.cardOpacity ?? undefined
              );
              return (
                <div
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                  }}
                >
                  {/* Page background zone */}
                  <div
                    style={{
                      position: "relative",
                      height: "72px",
                      background:
                        pv.pageDecoration === "bold-hero"
                          ? pv.pageDecorationBg1
                          : `linear-gradient(135deg, ${themePresetForm.gradientFrom}, ${themePresetForm.gradientTo})`,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "10px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: pv.textPrimary,
                        fontFamily: pv.headingFont,
                      }}
                    >
                      {themePresetForm.emoji} {themePresetForm.name || tr("untitled")}
                    </span>
                  </div>
                  {/* Card zone */}
                  <div style={{ background: pv.pageBg, padding: "10px 12px" }}>
                    <div
                      style={{
                        background: pv.cardBg,
                        border: `1px solid ${pv.cardBorder}`,
                        borderRadius: pv.cardRadius,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: pv.cardShadow,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: pv.textPrimary,
                            marginBottom: "2px",
                            fontFamily: pv.headingFont,
                          }}
                        >
                          {tr("eventDetails")}
                        </div>
                        <div style={{ fontSize: "11px", color: pv.textMuted }}>
                          {tr("saturday700Pm")}
                        </div>
                      </div>
                      {/* A picture of the theme's primary button, not a control. */}
                      <span
                        aria-hidden="true"
                        {...buttonProps(pv, { variant: "primary", size: "sm" })}
                        style={{
                          ...buttonStyle(pv, { variant: "primary", size: "sm" }),
                          cursor: "default",
                        }}
                      >
                        {tr("rsvp")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <Button
                theme={T}
                variant="secondary"
                type="button"
                onClick={() => setThemePresetForm(null)}
                style={{ flex: 1 }}
              >
                {tr("cancel")}
              </Button>
              {themePresetForm.id &&
                themePresetOriginal &&
                (() => {
                  const isDirty =
                    themePresetForm.name !== themePresetOriginal.name ||
                    themePresetForm.emoji !== themePresetOriginal.emoji ||
                    themePresetForm.base !== themePresetOriginal.base ||
                    themePresetForm.gradientFrom !== themePresetOriginal.gradientFrom ||
                    themePresetForm.gradientTo !== themePresetOriginal.gradientTo ||
                    themePresetForm.accentColor !== themePresetOriginal.accentColor ||
                    themePresetForm.seasonal !== themePresetOriginal.seasonal ||
                    themePresetForm.month !== themePresetOriginal.month ||
                    themePresetForm.cardOpacity !== themePresetOriginal.cardOpacity ||
                    (themePresetForm.fontId ?? null) !== (themePresetOriginal.fontId ?? null);
                  return isDirty ? (
                    <Button
                      theme={T}
                      variant="secondary"
                      type="button"
                      onClick={() => setThemePresetForm(themePresetOriginal)}
                      style={{ flex: 1 }}
                    >
                      {tr("reset")}
                    </Button>
                  ) : null;
                })()}
              <Button
                theme={T}
                variant="primary"
                type="submit"
                disabled={isSavingPreset}
                style={{ flex: 2 }}
              >
                {isSavingPreset
                  ? tr("saving")
                  : themePresetForm.id
                    ? tr("saveChanges")
                    : tr("createPreset")}
              </Button>
              {themePresetForm.id && (
                <Button
                  theme={T}
                  variant="secondary"
                  type="button"
                  disabled={isSavingPreset}
                  onClick={handleSaveThemePresetAsDefault}
                  style={{ flex: 2 }}
                >
                  {tr("saveAsDefault")}
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}
