"use client";
import { useTranslations } from "next-intl";

import { X } from "lucide-react";
import { APP_SHELL, APP_SHELL_THEME as T } from "@/lib/theme";
import { appCardStyle } from "@/components/ui/AppPrimitives";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Choice";
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
  const tr = useTranslations("Ui.Admin");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header card */}
      <div
        style={{
          ...appCardStyle,
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
              {tr("themePresets")}
            </h3>
            <p
              style={{
                color: APP_SHELL.textSecondary,
                fontSize: "13px",
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              {tr("manageThePresetThemesHostsCanPickFromIn")}
            </p>
          </div>
          <Button
            theme={T}
            variant="primary"
            style={{ whiteSpace: "nowrap" }}
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
          >
            {tr("newPreset")}
          </Button>
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
            {tr("noThemePresetsYetClickNewPresetToAdd")}
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
                    {preset.seasonal ? tr("seasonal") : ""}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button
                      theme={T}
                      variant="secondary"
                      size="sm"
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
                      style={{ flex: 1 }}
                    >
                      {tr("edit")}
                    </Button>
                    <Chip
                      theme={T}
                      selected={preset.active}
                      onClick={() => handleTogglePresetActive(preset)}
                      style={{ flex: 1 }}
                    >
                      {preset.active ? tr("active") : tr("inactive")}
                    </Chip>
                    <Button
                      theme={T}
                      variant="destructive"
                      size="sm"
                      aria-label={`${tr("delete")}: ${preset.name}`}
                      title={tr("delete")}
                      onClick={() => handleDeleteThemePreset(preset.id)}
                      style={{ padding: 0, width: "32px" }}
                    >
                      <X size={14} aria-hidden="true" />
                    </Button>
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
