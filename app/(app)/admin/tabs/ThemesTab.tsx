"use client";

import { APP_SHELL } from "@/lib/theme";
import type { AdminThemePreset, ThemePresetFormState } from "./types";

export function ThemesTab({
  themePresets,
  setThemePresetForm,
  setThemePresetOriginal,
  handleTogglePresetActive,
  handleDeleteThemePreset,
}: {
  themePresets: AdminThemePreset[];
  setThemePresetForm: React.Dispatch<React.SetStateAction<ThemePresetFormState | null>>;
  setThemePresetOriginal: React.Dispatch<React.SetStateAction<ThemePresetFormState | null>>;
  handleTogglePresetActive: (preset: AdminThemePreset) => Promise<void>;
  handleDeleteThemePreset: (id: string) => Promise<void>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header card */}
      <div
        style={{
          backgroundColor: APP_SHELL.cardBg,
          border: `1px solid ${APP_SHELL.cardBorder}`,
          borderRadius: APP_SHELL.cardRadius,
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: APP_SHELL.textPrimary,
                margin: 0,
              }}
            >
              Theme Presets
            </h3>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                fontSize: "13px",
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              Manage the preset themes hosts can pick from in the event settings. Inactive presets
              are hidden from hosts.
            </p>
          </div>
          <button
            onClick={() =>
              setThemePresetForm({
                name: "",
                emoji: "🎨",
                base: "DARK",
                gradientFrom: "#1a1a2e",
                gradientTo: "#16213e",
                accentColor: "#a855f7",
                seasonal: false,
                month: null,
                cardOpacity: null,
                fontId: null,
              })
            }
            style={{
              backgroundColor: APP_SHELL.accent,
              border: "none",
              color: "#fff",
              borderRadius: "10px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + New Preset
          </button>
        </div>

        <div
          style={{
            height: "1px",
            backgroundColor: APP_SHELL.navBorder,
            marginBottom: "20px",
          }}
        />

        {/* Preset grid */}
        {themePresets.length === 0 ? (
          <p
            style={{
              color: APP_SHELL.textSecondary,
              fontSize: "14px",
              textAlign: "center",
              padding: "40px 0",
            }}
          >
            No theme presets yet. Click &quot;+ New Preset&quot; to add one.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            {themePresets.map((preset) => (
              <div
                key={preset.id}
                style={{
                  border: `1px solid ${preset.active ? APP_SHELL.cardBorder : "rgba(255,255,255,0.05)"}`,
                  borderRadius: "14px",
                  overflow: "hidden",
                  opacity: preset.active ? 1 : 0.5,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Gradient preview */}
                <div
                  style={{
                    height: "60px",
                    background: `linear-gradient(135deg, ${preset.gradientFrom}, ${preset.gradientTo})`,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      background: preset.accentColor,
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.5)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      left: "8px",
                      fontSize: "16px",
                    }}
                  >
                    {preset.emoji}
                  </div>
                </div>
                {/* Info row */}
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: APP_SHELL.inputBg,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: APP_SHELL.textPrimary,
                      marginBottom: "2px",
                    }}
                  >
                    {preset.name}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: APP_SHELL.textSecondary,
                      marginBottom: "8px",
                    }}
                  >
                    {preset.base}
                    {preset.seasonal ? " · Seasonal" : ""}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        const vals = {
                          id: preset.id,
                          name: preset.name,
                          emoji: preset.emoji,
                          base: preset.base,
                          gradientFrom: preset.gradientFrom,
                          gradientTo: preset.gradientTo,
                          accentColor: preset.accentColor,
                          seasonal: preset.seasonal,
                          month: preset.month ?? null,
                          cardOpacity: preset.cardOpacity ?? null,
                          fontId: preset.fontId ?? null,
                        };
                        setThemePresetForm(vals);
                        setThemePresetOriginal(vals);
                      }}
                      style={{
                        flex: 1,
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "5px 0",
                        borderRadius: "7px",
                        border: `1px solid ${APP_SHELL.cardBorder}`,
                        backgroundColor: "transparent",
                        color: APP_SHELL.textSecondary,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePresetActive(preset)}
                      style={{
                        flex: 1,
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "5px 0",
                        borderRadius: "7px",
                        border: `1px solid ${preset.active ? "#22c55e44" : APP_SHELL.cardBorder}`,
                        backgroundColor: preset.active ? "rgba(34,197,94,0.1)" : "transparent",
                        color: preset.active ? "#22c55e" : APP_SHELL.textSecondary,
                        cursor: "pointer",
                      }}
                    >
                      {preset.active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => handleDeleteThemePreset(preset.id)}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "5px 8px",
                        borderRadius: "7px",
                        border: "1px solid rgba(239,68,68,0.3)",
                        backgroundColor: "transparent",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
