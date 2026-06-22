"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme } from "@/lib/theme";
import { saveEventTheme } from "@/app/actions/event";

type DbThemePreset = {
  id: string;
  name: string;
  emoji: string;
  base: BaseTheme;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
};

export function ThemePicker({
  eventId,
  current,
  presets = [],
  onClose,
  onSave,
}: {
  eventId: string;
  current: { base: BaseTheme; gradientFrom: string; gradientTo: string; accentColor: string };
  presets?: DbThemePreset[];
  onClose: () => void;
  onSave: (base: BaseTheme, gradientFrom: string, gradientTo: string, accentColor: string) => void;
}) {
  const [base, setBase] = useState<BaseTheme>(current.base);
  const [gradientFrom, setGradientFrom] = useState(current.gradientFrom);
  const [gradientTo, setGradientTo] = useState(current.gradientTo);
  const [accent, setAccent] = useState(current.accentColor);
  const [saving, setSaving] = useState(false);

  const isPreset = ACCENT_PRESETS.some((p) => p.value === accent);

  const handleSave = async () => {
    setSaving(true);
    await saveEventTheme(eventId, base, gradientFrom, gradientTo, accent);
    setSaving(false);
    onSave(base, gradientFrom, gradientTo, accent);
  };

  const applyPreset = (p: DbThemePreset) => {
    setBase(p.base);
    setGradientFrom(p.gradientFrom);
    setGradientTo(p.gradientTo);
    setAccent(p.accentColor);
  };

  const previewBg = `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`;

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
            maxHeight: "90vh",
            overflowY: "auto",
            pointerEvents: "auto",
            color: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>Event Theme</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "22px", padding: "2px 6px" }}>×</button>
          </div>

          {/* Style selector */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>
              Style
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {BASE_THEMES.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => {
                    setBase(bt.id);
                    setGradientFrom(bt.defaultGradientFrom);
                    setGradientTo(bt.defaultGradientTo);
                    setAccent(bt.defaultAccent);
                  }}
                  style={{
                    flex: 1, padding: "0", border: `2px solid ${base === bt.id ? "#fff" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "16px", cursor: "pointer", overflow: "hidden", background: "none",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ height: "52px", background: bt.preview }} />
                  <div style={{ padding: "8px 6px", color: "#fff", fontSize: "11px", fontWeight: 600, background: "rgba(255,255,255,0.05)" }}>
                    {bt.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>
              Presets
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {presets.filter((p) => p.base === base).map((p) => {
                const isActive = gradientFrom === p.gradientFrom && gradientTo === p.gradientTo && accent === p.accentColor;
                return (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: "8px 6px", border: `2px solid ${isActive ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "12px", cursor: "pointer",
                      background: isActive ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                      transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
                    }}
                  >
                    <div style={{ width: "100%", height: "28px", borderRadius: "6px", background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.accentColor, flexShrink: 0 }} />
                      <span style={{ fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Background colors */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>
              Background
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "5px" }}>Start</div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", cursor: "pointer" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "5px", background: gradientFrom, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{gradientFrom}</span>
                  <input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "5px" }}>End</div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", cursor: "pointer" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "5px", background: gradientTo, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{gradientTo}</span>
                  <input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                </label>
              </div>
            </div>
            {/* Live preview strip */}
            <div style={{ height: "32px", borderRadius: "8px", background: previewBg, border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Accent color */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>
              Accent Color
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setAccent(p.value)}
                  title={p.name}
                  style={{
                    width: "36px", height: "36px", borderRadius: "50%", background: p.value,
                    border: `3px solid ${accent === p.value ? "#fff" : "transparent"}`,
                    cursor: "pointer", position: "relative", transition: "border 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {accent === p.value && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
              ))}
              <label
                title="Custom color"
                style={{
                  width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
                  border: `3px solid ${!isPreset ? "#fff" : "transparent"}`,
                  overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  background: isPreset ? "rgba(255,255,255,0.1)" : accent,
                  transition: "border 0.15s",
                }}
              >
                <span style={{ fontSize: "16px", zIndex: 1 }}>🎨</span>
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
              </label>
            </div>

            {/* Live accent preview */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: accent, flexShrink: 0 }} />
              <div>
                <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Accent preview</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>{accent}</div>
              </div>
              <div style={{ marginLeft: "auto", background: accent, color: "#fff", padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700 }}>Button</div>
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ width: "100%", padding: "14px", background: accent, color: "#fff", border: "none", borderRadius: "14px", fontFamily: "inherit", fontSize: "15px", fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Apply Theme"}
          </button>
        </div>
      </div>
    </>
  );
}
