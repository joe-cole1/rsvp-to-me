"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, THEME_PRESETS, resolveTheme, type BaseTheme, getSortedPresets } from "@/lib/theme";
import { saveEventTheme } from "@/app/actions/event";

export function ThemePicker({
  eventId,
  current,
  onClose,
  onSave,
}: {
  eventId: string;
  current: { base: BaseTheme; accent: string; secondaryColor?: string | null; themePresetId?: string | null };
  onClose: () => void;
  onSave: (base: BaseTheme, accent: string, secondaryColor?: string | null, themePresetId?: string | null) => void;
}) {
  const [base, setBase] = useState<BaseTheme>(current.base);
  const [accent, setAccent] = useState(current.accent);
  const [secondary, setSecondary] = useState<string | null>(current.secondaryColor ?? null);
  const [presetId, setPresetId] = useState<string>(current.themePresetId ?? "custom");
  const [customColor, setCustomColor] = useState(current.accent);
  const [customSecondaryColor, setCustomSecondaryColor] = useState(current.secondaryColor ?? "#ec4899");
  const [customizeOpen, setCustomizeOpen] = useState(current.themePresetId === "custom" || !current.themePresetId);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [themeFilter, setThemeFilter] = useState<"all" | "seasonal" | "general">("all");

  const sortedPresets = getSortedPresets();
  const filteredPresets = sortedPresets.filter((p) => {
    if (p.id === "custom") return false;

    const matchesSearch =
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      themeFilter === "all" ||
      (themeFilter === "seasonal" && p.seasonal) ||
      (themeFilter === "general" && !p.seasonal);

    return matchesSearch && matchesFilter;
  });

  const isPresetAccent = ACCENT_PRESETS.some((p) => p.value === accent);
  const isPresetSecondary = secondary === null || ACCENT_PRESETS.some((p) => p.value === secondary);

  const handlePresetSelect = (p: typeof THEME_PRESETS[number]) => {
    setPresetId(p.id);
    setBase(p.config.base);
    setAccent(p.config.accent);
    setSecondary(p.config.secondaryColor);
    if (p.id !== "custom") {
      setCustomizeOpen(false);
    }
  };

  const handleBaseChange = (newBase: BaseTheme) => {
    setBase(newBase);
    setPresetId("custom");
  };

  const handleAccentChange = (newAccent: string) => {
    setAccent(newAccent);
    setPresetId("custom");
  };

  const handleSecondaryChange = (newSecondary: string | null) => {
    setSecondary(newSecondary);
    setPresetId("custom");
  };

  const handleSave = async () => {
    setSaving(true);
    await saveEventTheme(eventId, base, accent, secondary, presetId);
    setSaving(false);
    onSave(base, accent, secondary, presetId);
  };

  const previewTheme = resolveTheme(base, accent, secondary, presetId);

  // Suggested secondary color for accent presets
  const activeAccentPreset = ACCENT_PRESETS.find((p) => p.value === accent);
  const suggestedSecondary = activeAccentPreset?.suggestedSecondary;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />

      {/* Modal */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 201, display: "flex", alignItems: "flex-end", justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(15,15,20,0.97)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px 24px 0 0",
            padding: "24px 20px 40px",
            width: "100%",
            maxWidth: "480px",
            pointerEvents: "auto",
            color: "#fff",
            maxHeight: "85vh",
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>Event Theme</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "22px", padding: "2px 6px" }}>×</button>
          </div>
          {/* SECTION 1: PRESETS */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "12px" }}>
              Themes
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search themes (e.g. Summer, Halloween)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "13px",
                marginBottom: "12px",
                outline: "none",
              }}
            />

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              {(["all", "seasonal", "general"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setThemeFilter(filter)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: `1px solid ${themeFilter === filter ? "#fff" : "rgba(255,255,255,0.1)"}`,
                    background: themeFilter === filter ? "rgba(255,255,255,0.15)" : "transparent",
                    color: "#fff",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s ease",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Scrollable vertical grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "10px",
                maxHeight: "300px",
                overflowY: "auto",
                paddingRight: "4px",
                scrollbarWidth: "thin",
              }}
            >
              {filteredPresets.map((p) => {
                const isSelected = presetId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePresetSelect(p)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "6px",
                      padding: "12px 10px",
                      border: `2px solid ${isSelected ? "#fff" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: "14px",
                      background: isSelected ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                      cursor: "pointer",
                      color: "#fff",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>{p.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{p.label}</span>
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{p.description}</span>
                    <div style={{ width: "36px", height: "8px", borderRadius: "4px", background: `linear-gradient(90deg, ${p.config.accent}, ${p.config.secondaryColor})` }} />
                  </button>
                );
              })}
              {filteredPresets.length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                  No themes found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* CUSTOMIZE TOGGLE */}
          <button
            onClick={() => setCustomizeOpen(!customizeOpen)}
            style={{
              width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", marginBottom: "20px", fontSize: "13px", fontWeight: 600,
            }}
          >
            <span>🎨 Customize Style</span>
            {customizeOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* SECTION 2: CUSTOMIZE PANEL */}
          {customizeOpen && (
            <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "20px" }}>
              {/* Base theme */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>
                  Style
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {BASE_THEMES.map((bt) => (
                    <button
                      key={bt.id}
                      onClick={() => handleBaseChange(bt.id)}
                      style={{
                        flex: 1, padding: "0", border: `2px solid ${base === bt.id ? "#fff" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: "12px", cursor: "pointer", overflow: "hidden", background: "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ height: "36px", background: bt.preview }} />
                      <div style={{ padding: "6px 4px", color: "#fff", fontSize: "10px", fontWeight: 600, background: "rgba(255,255,255,0.04)" }}>
                        {bt.label.split(" ")[0]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>
                  Primary Accent
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => handleAccentChange(p.value)}
                      title={p.name}
                      style={{
                        width: "30px", height: "30px", borderRadius: "50%", background: p.value,
                        border: `2px solid ${accent === p.value ? "#fff" : "transparent"}`,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {accent === p.value && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>
                  ))}

                  <label
                    title="Custom color"
                    style={{
                      width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer",
                      border: `2px solid ${!isPresetAccent ? "#fff" : "transparent"}`,
                      overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isPresetAccent ? "rgba(255,255,255,0.1)" : accent,
                    }}
                  >
                    <span style={{ fontSize: "14px", zIndex: 1 }}>🎨</span>
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => { setCustomColor(e.target.value); handleAccentChange(e.target.value); }}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    />
                  </label>
                </div>
              </div>

              {/* Secondary color */}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>
                  Second Color
                </div>
                {suggestedSecondary && (
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>
                    Suggested with this accent: <button onClick={() => handleSecondaryChange(suggestedSecondary)} style={{ background: "none", border: "none", color: suggestedSecondary, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}>{suggestedSecondary}</button>
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {/* None/Auto Option */}
                  <button
                    onClick={() => handleSecondaryChange(null)}
                    style={{
                      padding: "4px 8px", borderRadius: "15px", border: `2px solid ${secondary === null ? "#fff" : "rgba(255,255,255,0.08)"}`,
                      background: secondary === null ? "rgba(255,255,255,0.08)" : "transparent", color: "#fff",
                      fontSize: "11px", fontWeight: 600, cursor: "pointer", height: "30px", display: "flex", alignItems: "center", gap: "4px"
                    }}
                  >
                    Auto
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: resolveTheme("DARK", accent, null).secondaryAccent, border: "1px solid rgba(255,255,255,0.2)" }} />
                  </button>

                  {ACCENT_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => handleSecondaryChange(p.value)}
                      title={p.name}
                      style={{
                        width: "30px", height: "30px", borderRadius: "50%", background: p.value,
                        border: `2px solid ${secondary === p.value ? "#fff" : "transparent"}`,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {secondary === p.value && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>
                  ))}

                  <label
                    title="Custom color"
                    style={{
                      width: "30px", height: "30px", borderRadius: "50%", cursor: "pointer",
                      border: `2px solid ${!isPresetSecondary ? "#fff" : "transparent"}`,
                      overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isPresetSecondary ? "rgba(255,255,255,0.1)" : (secondary ?? "#ec4899"),
                    }}
                  >
                    <span style={{ fontSize: "14px", zIndex: 1 }}>🎨</span>
                    <input
                      type="color"
                      value={customSecondaryColor}
                      onChange={(e) => { setCustomSecondaryColor(e.target.value); handleSecondaryChange(e.target.value); }}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* LIVE PREVIEW CARD */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", marginBottom: "20px" }}>
            <div style={{
              width: "120px", height: "80px", borderRadius: "12px", background: previewTheme.pageBg,
              position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {/* Page decoration orbs represented in mini */}
              {previewTheme.pageDecoration === "dark-orbs" && (
                <>
                  <div style={{ position: "absolute", top: "-10px", left: "10px", width: "40px", height: "40px", borderRadius: "50%", background: previewTheme.pageDecorationBg1, filter: "blur(4px)" }} />
                  <div style={{ position: "absolute", bottom: "-5px", right: "-5px", width: "30px", height: "30px", borderRadius: "50%", background: previewTheme.pageDecorationBg2, filter: "blur(4px)" }} />
                </>
              )}
              {previewTheme.pageDecoration === "soft-blobs" && (
                <>
                  <div style={{ position: "absolute", top: "-5px", right: "-5px", width: "35px", height: "35px", borderRadius: "50%", background: previewTheme.pageDecorationBg1, filter: "blur(5px)" }} />
                  <div style={{ position: "absolute", bottom: "-10px", left: "-5px", width: "30px", height: "30px", borderRadius: "50%", background: previewTheme.pageDecorationBg2, filter: "blur(5px)" }} />
                </>
              )}
              {previewTheme.pageDecoration === "bold-hero" && (
                <div style={{ position: "absolute", inset: 0, background: previewTheme.pageDecorationBg1 }} />
              )}
              {/* Mini content card */}
              <div style={{
                width: "80px", height: "54px", borderRadius: "8px", background: previewTheme.cardBg,
                border: `1px solid ${previewTheme.cardBorder}`, padding: "6px", display: "flex",
                flexDirection: "column", justifyContent: "space-between", position: "relative", zIndex: 1,
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ width: "30px", height: "4px", borderRadius: "2px", background: previewTheme.textPrimary }} />
                  <div style={{ width: "45px", height: "3px", borderRadius: "1.5px", background: previewTheme.textSecondary }} />
                </div>
                <div style={{
                  width: "100%", height: "10px", borderRadius: "3px", background: previewTheme.accent,
                  color: previewTheme.accentFg, fontSize: "5px", fontWeight: "bold", display: "flex",
                  alignItems: "center", justifyContent: "center", textTransform: previewTheme.btnTransform as "none" | "capitalize" | "uppercase" | "lowercase",
                }}>
                  RSVP
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: 700 }}>
                {presetId !== "custom" ? THEME_PRESETS.find(p => p.id === presetId)?.label : "Custom Theme"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "2px" }}>
                Primary: {accent}<br />
                Second: {secondary ?? "Auto"}
              </div>
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: "100%", padding: "14px", background: accent, color: previewTheme.accentFg, border: "none", borderRadius: "14px", fontFamily: "inherit", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Apply Theme"}
          </button>
        </div>
      </div>
    </>
  );
}
