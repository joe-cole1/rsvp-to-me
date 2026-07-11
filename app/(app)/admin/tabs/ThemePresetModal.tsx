"use client";

import {
  APP_SHELL,
  BASE_THEMES,
  ACCENT_PRESETS,
  getDefaultCardOpacity,
  resolveTheme,
} from "@/lib/theme";
import { FONT_OPTIONS, FONT_CATEGORY_LABELS, getFontById } from "@/lib/fonts";
import type { AdminThemePreset, ThemePresetFormState, ThemeSnapObj } from "./types";

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
  return (
    <>
      {themePresetForm && (
        <>
          <div
            onClick={() => setThemePresetForm(null)}
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 1001,
              width: "min(500px, 92vw)",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "#16161e",
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: "20px",
              padding: "28px 24px 24px",
              color: APP_SHELL.textPrimary,
            }}
          >
            {(() => {
              const editingPreset = themePresetForm.id
                ? themePresets.find((p) => p.id === themePresetForm.id)
                : null;
              const defSnap = (editingPreset?.defaultSnapshot as ThemeSnapObj | null) ?? null;
              const origSnap = (editingPreset?.originalSnapshot as ThemeSnapObj | null) ?? null;
              const formDiffersFromDefault =
                defSnap &&
                (themePresetForm.name !== defSnap.name ||
                  themePresetForm.emoji !== defSnap.emoji ||
                  themePresetForm.base !== defSnap.base ||
                  themePresetForm.gradientFrom !== defSnap.gradientFrom ||
                  themePresetForm.gradientTo !== defSnap.gradientTo ||
                  themePresetForm.accentColor !== defSnap.accentColor ||
                  themePresetForm.seasonal !== defSnap.seasonal ||
                  themePresetForm.month !== (defSnap.month ?? null) ||
                  (themePresetForm.cardOpacity ?? null) !== (defSnap.cardOpacity ?? null) ||
                  (themePresetForm.fontId ?? null) !== (defSnap.fontId ?? null));
              const origDiffersFromDefault =
                origSnap &&
                defSnap &&
                (origSnap.name !== defSnap.name ||
                  origSnap.emoji !== defSnap.emoji ||
                  origSnap.base !== defSnap.base ||
                  origSnap.gradientFrom !== defSnap.gradientFrom ||
                  origSnap.gradientTo !== defSnap.gradientTo ||
                  origSnap.accentColor !== defSnap.accentColor ||
                  origSnap.seasonal !== defSnap.seasonal ||
                  (origSnap.month ?? null) !== (defSnap.month ?? null) ||
                  (origSnap.cardOpacity ?? null) !== (defSnap.cardOpacity ?? null) ||
                  (origSnap.fontId ?? null) !== (defSnap.fontId ?? null));
              const formDiffersFromOriginal =
                origSnap &&
                (themePresetForm.name !== origSnap.name ||
                  themePresetForm.emoji !== origSnap.emoji ||
                  themePresetForm.base !== origSnap.base ||
                  themePresetForm.gradientFrom !== origSnap.gradientFrom ||
                  themePresetForm.gradientTo !== origSnap.gradientTo ||
                  themePresetForm.accentColor !== origSnap.accentColor ||
                  themePresetForm.seasonal !== origSnap.seasonal ||
                  themePresetForm.month !== (origSnap.month ?? null) ||
                  (themePresetForm.cardOpacity ?? null) !== (origSnap.cardOpacity ?? null) ||
                  (themePresetForm.fontId ?? null) !== (origSnap.fontId ?? null));
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
                    style={{
                      margin: 0,
                      fontSize: "17px",
                      fontWeight: 700,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {themePresetForm.id ? "Edit Preset" : "New Preset"}
                  </h3>
                  {formDiffersFromDefault && defSnap && (
                    <button
                      type="button"
                      onClick={() => setThemePresetForm((f) => f && { ...f, ...defSnap })}
                      style={{
                        background: "none",
                        border: "1px solid rgba(139,92,246,0.5)",
                        borderRadius: "7px",
                        color: "#a78bfa",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ↺ Reset to Default
                    </button>
                  )}
                  {origDiffersFromDefault && formDiffersFromOriginal && origSnap && (
                    <button
                      type="button"
                      onClick={() => setThemePresetForm((f) => f && { ...f, ...origSnap })}
                      style={{
                        background: "none",
                        border: `1px solid ${APP_SHELL.cardBorder}`,
                        borderRadius: "7px",
                        color: APP_SHELL.textSecondary,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "4px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ↺ Reset to Original
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setThemePresetForm(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: APP_SHELL.textSecondary,
                      cursor: "pointer",
                      fontSize: "20px",
                      padding: "2px 6px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })()}

            <form
              onSubmit={handleSaveThemePreset}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Name + emoji row */}
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: APP_SHELL.textSecondary,
                    }}
                  >
                    EMOJI
                  </label>
                  <input
                    type="text"
                    value={themePresetForm.emoji}
                    onChange={(e) =>
                      setThemePresetForm((f) => f && { ...f, emoji: e.target.value })
                    }
                    maxLength={2}
                    style={{
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: "8px",
                      padding: "9px",
                      fontSize: "18px",
                      textAlign: "center",
                      color: APP_SHELL.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: APP_SHELL.textSecondary,
                    }}
                  >
                    NAME
                  </label>
                  <input
                    type="text"
                    value={themePresetForm.name}
                    onChange={(e) => setThemePresetForm((f) => f && { ...f, name: e.target.value })}
                    required
                    placeholder="e.g. Midnight Purple"
                    style={{
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: "8px",
                      padding: "9px 12px",
                      fontSize: "14px",
                      color: APP_SHELL.textPrimary,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Base style */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                  }}
                >
                  BASE STYLE
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {BASE_THEMES.map((bt) => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => setThemePresetForm((f) => f && { ...f, base: bt.id })}
                      style={{
                        flex: 1,
                        padding: "0",
                        overflow: "hidden",
                        cursor: "pointer",
                        border: `2px solid ${themePresetForm.base === bt.id ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
                        borderRadius: "10px",
                        background: "none",
                      }}
                    >
                      <div style={{ height: "36px", background: bt.preview }} />
                      <div
                        style={{
                          padding: "5px 4px",
                          color: APP_SHELL.textPrimary,
                          fontSize: "11px",
                          fontWeight: 600,
                          backgroundColor: APP_SHELL.inputBg,
                        }}
                      >
                        {bt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gradient colors */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                  }}
                >
                  BACKGROUND GRADIENT
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <label
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        background: themePresetForm.gradientFrom,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: APP_SHELL.textSecondary,
                        fontFamily: "monospace",
                      }}
                    >
                      {themePresetForm.gradientFrom}
                    </span>
                    <input
                      type="color"
                      value={themePresetForm.gradientFrom}
                      onChange={(e) =>
                        setThemePresetForm((f) => f && { ...f, gradientFrom: e.target.value })
                      }
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                    />
                  </label>
                  <label
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        background: themePresetForm.gradientTo,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "11px",
                        color: APP_SHELL.textSecondary,
                        fontFamily: "monospace",
                      }}
                    >
                      {themePresetForm.gradientTo}
                    </span>
                    <input
                      type="color"
                      value={themePresetForm.gradientTo}
                      onChange={(e) =>
                        setThemePresetForm((f) => f && { ...f, gradientTo: e.target.value })
                      }
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                    />
                  </label>
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
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                  }}
                >
                  ACCENT COLOR
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "7px",
                    marginBottom: "4px",
                  }}
                >
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setThemePresetForm((f) => f && { ...f, accentColor: p.value })}
                      title={p.name}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: p.value,
                        border: `2px solid ${themePresetForm.accentColor === p.value ? "#fff" : "transparent"}`,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                  <label
                    title="Custom"
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: themePresetForm.accentColor,
                      border: "2px solid rgba(255,255,255,0.3)",
                      cursor: "pointer",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <input
                      type="color"
                      value={themePresetForm.accentColor}
                      onChange={(e) =>
                        setThemePresetForm((f) => f && { ...f, accentColor: e.target.value })
                      }
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                      }}
                    />
                  </label>
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
                  <input
                    type="checkbox"
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
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Seasonal preset
                </label>
                {themePresetForm.seasonal && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <label
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: APP_SHELL.textSecondary,
                      }}
                    >
                      MONTH (1–12)
                    </label>
                    <input
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
                      placeholder="e.g. 10"
                      style={{
                        width: "72px",
                        backgroundColor: APP_SHELL.inputBg,
                        border: `1px solid ${APP_SHELL.inputBorder}`,
                        borderRadius: "8px",
                        padding: "7px 10px",
                        fontSize: "14px",
                        color: APP_SHELL.textPrimary,
                        outline: "none",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Heading font */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: APP_SHELL.textSecondary,
                  }}
                >
                  HEADING FONT
                </label>
                <select
                  value={themePresetForm.fontId ?? ""}
                  onChange={(e) =>
                    setThemePresetForm((f) => f && { ...f, fontId: e.target.value || null })
                  }
                  style={{
                    backgroundColor: APP_SHELL.inputBg,
                    border: `1px solid ${APP_SHELL.inputBorder}`,
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "14px",
                    color: APP_SHELL.textPrimary,
                    outline: "none",
                  }}
                >
                  <option value="">Theme default</option>
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} ({FONT_CATEGORY_LABELS[f.category]})
                    </option>
                  ))}
                </select>
                {themePresetForm.fontId && (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      backgroundColor: APP_SHELL.inputBg,
                      border: `1px solid ${APP_SHELL.inputBorder}`,
                      color: APP_SHELL.textPrimary,
                      fontFamily: (() => {
                        const f = getFontById(themePresetForm.fontId);
                        return f ? `var(${f.cssVar}), ${f.fallback}` : "inherit";
                      })(),
                      fontSize: "18px",
                      textAlign: "center",
                    }}
                  >
                    You&rsquo;re Invited!
                  </div>
                )}
              </div>

              {/* Card opacity */}
              {(() => {
                const defaultOp = getDefaultCardOpacity(themePresetForm.base);
                const currentOp = themePresetForm.cardOpacity ?? defaultOp;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: APP_SHELL.textSecondary,
                      }}
                    >
                      CARD OPACITY
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="range"
                        min={0.4}
                        max={1}
                        step={0.05}
                        value={currentOp}
                        onChange={(e) =>
                          setThemePresetForm(
                            (f) => f && { ...f, cardOpacity: parseFloat(e.target.value) }
                          )
                        }
                        style={{ flex: 1, accentColor: APP_SHELL.accent }}
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
                    <div style={{ fontSize: "11px", color: APP_SHELL.textSecondary }}>
                      Controls card transparency. Default for {themePresetForm.base}:{" "}
                      {Math.round(defaultOp * 100)}%
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
                        {themePresetForm.emoji} {themePresetForm.name || "Untitled"}
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
                            Event details
                          </div>
                          <div style={{ fontSize: "11px", color: pv.textMuted }}>
                            Saturday · 7:00 PM
                          </div>
                        </div>
                        <button
                          style={{
                            background: pv.accent,
                            color: pv.accentFg,
                            border: "none",
                            borderRadius: pv.btnRadius,
                            padding: "5px 12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "default",
                          }}
                        >
                          RSVP
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setThemePresetForm(null)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "transparent",
                    border: `1px solid ${APP_SHELL.cardBorder}`,
                    borderRadius: "10px",
                    color: APP_SHELL.textSecondary,
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
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
                      <button
                        type="button"
                        onClick={() => setThemePresetForm(themePresetOriginal)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          background: "transparent",
                          border: `1px solid rgba(239,68,68,0.4)`,
                          borderRadius: "10px",
                          color: "#ef4444",
                          fontSize: "14px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ↺ Reset
                      </button>
                    ) : null;
                  })()}
                <button
                  type="submit"
                  disabled={isSavingPreset}
                  style={{
                    flex: 2,
                    padding: "12px",
                    background: APP_SHELL.accent,
                    border: "none",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    opacity: isSavingPreset ? 0.7 : 1,
                  }}
                >
                  {isSavingPreset
                    ? "Saving…"
                    : themePresetForm.id
                      ? "Save Changes"
                      : "Create Preset"}
                </button>
                {themePresetForm.id && (
                  <button
                    type="button"
                    disabled={isSavingPreset}
                    onClick={handleSaveThemePresetAsDefault}
                    style={{
                      flex: 2,
                      padding: "12px",
                      background: "transparent",
                      border: "1px solid rgba(139,92,246,0.5)",
                      borderRadius: "10px",
                      color: "#a78bfa",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: isSavingPreset ? 0.7 : 1,
                    }}
                  >
                    Save as Default
                  </button>
                )}
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
