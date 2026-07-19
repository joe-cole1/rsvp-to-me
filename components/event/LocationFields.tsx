"use client";

import type { ResolvedTheme } from "@/lib/theme";

export type EditableLocationType = "PHYSICAL" | "VIRTUAL" | "TBD";

type LocationFieldTheme = Pick<
  ResolvedTheme,
  "accent" | "accentFg" | "inputBg" | "inputBorder" | "textPrimary" | "textSecondary" | "textMuted"
> & { inputRadius?: string };

export type LocationValue = {
  type: EditableLocationType;
  name: string;
  address: string;
  virtualUrl: string;
};

export function LocationFields({
  value,
  onChange,
  theme: t,
  submitNames = false,
  compact = false,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  theme: LocationFieldTheme;
  submitNames?: boolean;
  compact?: boolean;
}) {
  const set = (next: Partial<LocationValue>) => onChange({ ...value, ...next });
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: compact ? "10px 12px" : "10px 14px",
    background: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: t.inputRadius ?? "10px",
    color: t.textPrimary,
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const fieldStyle: React.CSSProperties = { marginBottom: compact ? "10px" : "14px" };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: compact ? "11px" : "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: t.textMuted,
    marginBottom: "6px",
  };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: compact ? "8px 4px" : "10px 8px",
    background: active ? t.accent : t.inputBg,
    color: active ? t.accentFg : t.textSecondary,
    border: `1px solid ${active ? t.accent : t.inputBorder}`,
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: compact ? "12px" : "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div>
      {submitNames && <input type="hidden" name="locationType" value={value.type} />}
      <div style={fieldStyle}>
        <span style={labelStyle}>Type</span>
        <div style={{ display: "flex", gap: compact ? "6px" : "8px" }}>
          {(["PHYSICAL", "VIRTUAL", "TBD"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={value.type === type}
              style={tabStyle(value.type === type)}
              onClick={() => set({ type })}
            >
              {type === "PHYSICAL" ? "📍 In person" : type === "VIRTUAL" ? "💻 Virtual" : "📌 TBD"}
            </button>
          ))}
        </div>
      </div>

      {value.type === "PHYSICAL" && (
        <>
          <label style={fieldStyle}>
            <span style={labelStyle}>Venue name</span>
            <input
              name={submitNames ? "locationName" : undefined}
              placeholder="Venue or place name"
              value={value.name}
              onChange={(event) => set({ name: event.target.value })}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Address</span>
            <input
              name={submitNames ? "locationAddress" : undefined}
              placeholder="123 Main St, City"
              value={value.address}
              onChange={(event) => set({ address: event.target.value })}
              style={inputStyle}
            />
          </label>
        </>
      )}

      {value.type === "VIRTUAL" && (
        <label style={fieldStyle}>
          <span style={labelStyle}>Virtual link</span>
          <input
            name={submitNames ? "virtualUrl" : undefined}
            type="url"
            placeholder="https://zoom.us/j/..."
            value={value.virtualUrl}
            onChange={(event) => set({ virtualUrl: event.target.value })}
            style={inputStyle}
          />
        </label>
      )}

      {value.type === "TBD" && (
        <p style={{ fontSize: "13px", color: t.textMuted, margin: "6px 0 14px", lineHeight: 1.4 }}>
          We&apos;ll show &quot;To Be Determined (TBD)&quot; to guests until details are added.
        </p>
      )}
    </div>
  );
}
