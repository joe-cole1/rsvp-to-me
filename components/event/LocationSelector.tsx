"use client";

import { useState } from "react";
import { APP_SHELL } from "@/lib/theme";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: APP_SHELL.inputBg,
  border: `1px solid ${APP_SHELL.inputBorder}`,
  borderRadius: APP_SHELL.inputRadius,
  color: APP_SHELL.textPrimary,
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  colorScheme: "dark",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 700,
          textTransform: "none",
          letterSpacing: "0.02em",
          color: APP_SHELL.textMuted,
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export default function LocationSelector() {
  const [type, setType] = useState<"PHYSICAL" | "VIRTUAL" | "TBD">("PHYSICAL");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 8px",
    background: active ? APP_SHELL.accent : APP_SHELL.inputBg,
    color: active ? APP_SHELL.textPrimary : APP_SHELL.textSecondary,
    border: active ? `1px solid ${APP_SHELL.accent}` : `1px solid ${APP_SHELL.inputBorder}`,
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    transition: "all 0.15s ease-in-out",
  });

  return (
    <div>
      {/* Hidden input to pass value in form submission */}
      <input type="hidden" name="locationType" value={type} />

      <Field label="Type">
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            style={tabStyle(type === "PHYSICAL")}
            onClick={() => setType("PHYSICAL")}
          >
            📍 In person
          </button>
          <button
            type="button"
            style={tabStyle(type === "VIRTUAL")}
            onClick={() => setType("VIRTUAL")}
          >
            💻 Virtual
          </button>
          <button type="button" style={tabStyle(type === "TBD")} onClick={() => setType("TBD")}>
            📌 TBD
          </button>
        </div>
      </Field>

      {type === "PHYSICAL" && (
        <>
          <Field label="Venue name">
            <input name="locationName" placeholder="Casa de Jane" style={inputStyle} />
          </Field>
          <Field label="Address">
            <input
              name="locationAddress"
              placeholder="123 Main St, Brooklyn, NY"
              style={inputStyle}
            />
          </Field>
        </>
      )}

      {type === "VIRTUAL" && (
        <Field label="Virtual link">
          <input
            name="virtualUrl"
            type="url"
            placeholder="https://zoom.us/j/..."
            style={inputStyle}
          />
        </Field>
      )}

      {type === "TBD" && (
        <p
          style={{
            fontSize: "13px",
            color: APP_SHELL.textMuted,
            marginTop: "6px",
            marginBottom: "14px",
            lineHeight: 1.4,
          }}
        >
          We&apos;ll show &quot;To Be Determined (TBD)&quot; to guests until details are added.
        </p>
      )}
    </div>
  );
}
