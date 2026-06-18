"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme } from "@/lib/theme";
import { saveEventTheme } from "@/app/actions/event";

export function ThemePicker({
  eventId,
  current,
  onClose,
  onSave,
}: {
  eventId: string;
  current: { base: BaseTheme; accent: string };
  onClose: () => void;
  onSave: (base: BaseTheme, accent: string) => void;
}) {
  const [base, setBase] = useState<BaseTheme>(current.base);
  const [accent, setAccent] = useState(current.accent);
  const [customColor, setCustomColor] = useState(current.accent);
  const [saving, setSaving] = useState(false);

  const isPreset = ACCENT_PRESETS.some((p) => p.value === accent);

  const handleSave = async () => {
    setSaving(true);
    await saveEventTheme(eventId, base, accent);
    setSaving(false);
    onSave(base, accent);
  };

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
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>Event Theme</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "22px", padding: "2px 6px" }}>×</button>
          </div>

          {/* Base theme */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "10px" }}>
              Style
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {BASE_THEMES.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => setBase(bt.id)}
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

              {/* Custom color swatch */}
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
                  value={customColor}
                  onChange={(e) => { setCustomColor(e.target.value); setAccent(e.target.value); }}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                />
              </label>
            </div>

            {/* Live preview swatch */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: "rgba(255,255,255,0.05)", borderRadius: "12px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: accent, flexShrink: 0 }} />
              <div>
                <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Preview</div>
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
