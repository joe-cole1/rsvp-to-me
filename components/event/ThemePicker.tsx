"use client";

import { useState, useMemo } from "react";
import { Check } from "lucide-react";
import { ACCENT_PRESETS, BASE_THEMES, type BaseTheme, getSortedPresets } from "@/lib/theme";
import { saveEventTheme } from "@/app/actions/event";

type DbThemePreset = {
  id: string;
  name: string;
  emoji: string;
  base: BaseTheme;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  seasonal?: boolean | null;
  month?: number | null;
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "seasonal" | "general" | "light" | "dark">("all");
  const [customizeOpen, setCustomizeOpen] = useState(false);

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

  const sortedPresets = useMemo(() => getSortedPresets(presets), [presets]);

  const visiblePresets = useMemo(() => {
    let result = sortedPresets;
    if (filter === "seasonal") result = result.filter((p) => p.seasonal);
    if (filter === "general") result = result.filter((p) => !p.seasonal);
    if (filter === "light") result = result.filter((p) => p.base === "SOFT" || p.base === "BOLD");
    if (filter === "dark") result = result.filter((p) => p.base === "DARK");
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.emoji.includes(q));
    }
    return result;
  }, [sortedPresets, filter, search]);

  const previewBg = `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`;

  const filterPillStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px",
    borderRadius: "20px",
    border: `1px solid ${active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}`,
    background: active ? "rgba(255,255,255,0.15)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  });

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>Event Theme</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "22px", padding: "2px 6px" }}>×</button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search themes…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "9px 14px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px", color: "#fff", fontSize: "14px", outline: "none",
              }}
            />
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: "7px", marginBottom: "14px", overflowX: "auto" }}>
            {(["all", "seasonal", "general", "light", "dark"] as const).map((f) => (
              <button key={f} style={{ ...filterPillStyle(filter === f), whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "seasonal" ? "🎉 Seasonal" : f === "general" ? "🎨 General" : f === "light" ? "☀️ Light" : "🌙 Dark"}
              </button>
            ))}
          </div>

          {/* Preset grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: "8px",
              maxHeight: "340px",
              overflowY: "auto",
              marginBottom: "16px",
            }}
          >
            {visiblePresets.map((p) => {
              const isActive = base === p.base && gradientFrom === p.gradientFrom && gradientTo === p.gradientTo && accent === p.accentColor;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: "0",
                    border: `2px solid ${isActive ? accent : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "12px",
                    cursor: "pointer",
                    background: isActive ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.04)",
                    transition: "all 0.15s",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ position: "relative", height: "40px", background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientTo})` }}>
                    <span style={{ position: "absolute", top: "4px", left: "5px", fontSize: "11px" }}>{p.emoji}</span>
                    <div style={{ position: "absolute", bottom: "4px", right: "5px", width: "8px", height: "8px", borderRadius: "50%", background: p.accentColor, border: "1px solid rgba(255,255,255,0.3)" }} />
                  </div>
                  <div style={{ padding: "5px 6px", fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.7)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                </button>
              );
            })}
            {visiblePresets.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "24px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
                No themes match your search
              </div>
            )}
          </div>

          {/* Customize accordion */}
          <div style={{ marginBottom: "20px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", overflow: "hidden" }}>
            <button
              onClick={() => setCustomizeOpen((o) => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "none",
                cursor: "pointer", color: "#fff", fontSize: "13px", fontWeight: 600,
              }}
            >
              <span>Customize colors</span>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", transform: customizeOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
            </button>

            {customizeOpen && (
              <div style={{ padding: "16px" }}>
                {/* Style selector */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Style</div>
                  <div style={{ display: "flex", gap: "8px" }}>
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
                          borderRadius: "10px", cursor: "pointer", overflow: "hidden", background: "none", transition: "border-color 0.15s",
                        }}
                      >
                        <div style={{ height: "36px", background: bt.preview }} />
                        <div style={{ padding: "5px 4px", color: "#fff", fontSize: "10px", fontWeight: 600, background: "rgba(255,255,255,0.05)" }}>{bt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background colors */}
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Background</div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>Start</div>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", cursor: "pointer" }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: gradientFrom, flexShrink: 0 }} />
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{gradientFrom}</span>
                        <input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                      </label>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>End</div>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", cursor: "pointer" }}>
                        <div style={{ width: "18px", height: "18px", borderRadius: "4px", background: gradientTo, flexShrink: 0 }} />
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{gradientTo}</span>
                        <input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                      </label>
                    </div>
                  </div>
                  <div style={{ height: "28px", borderRadius: "6px", background: previewBg, border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>

                {/* Accent color */}
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Accent Color</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                    {ACCENT_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setAccent(p.value)}
                        title={p.name}
                        style={{
                          width: "32px", height: "32px", borderRadius: "50%", background: p.value,
                          border: `3px solid ${accent === p.value ? "#fff" : "transparent"}`,
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        {accent === p.value && <Check size={12} color="#fff" strokeWidth={3} />}
                      </button>
                    ))}
                    <label
                      title="Custom color"
                      style={{
                        width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer",
                        border: `3px solid ${!isPreset ? "#fff" : "transparent"}`,
                        overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                        background: isPreset ? "rgba(255,255,255,0.1)" : accent,
                      }}
                    >
                      <span style={{ fontSize: "14px", zIndex: 1 }}>🎨</span>
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
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
