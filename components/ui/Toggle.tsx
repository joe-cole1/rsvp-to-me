"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import { DISABLED_OPACITY } from "./Button";

/**
 * The one on/off switch (docs/engineering/design-language.md, Components → Switch):
 * a choice that applies at once. The whole row is the 40px hit area. The track is
 * `accent` when on and `inputBg` when off; disabled is 0.45 with a not-allowed cursor.
 *
 * Without `description` the label reads as a row label (`textSecondary`); with one,
 * the label is the setting's name (`textPrimary`) and the description sits under it.
 */
export function Toggle({
  label,
  description,
  value,
  onChange,
  theme: t,
  disabled = false,
  style,
}: {
  label: string;
  description?: ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ResolvedTheme;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="rsvp-control"
      style={
        {
          "--rsvp-focus": t.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          width: "100%",
          minHeight: "40px",
          boxSizing: "border-box",
          margin: "0 0 12px",
          padding: "4px 0",
          border: "none",
          borderRadius: "8px",
          backgroundColor: "transparent",
          color: "inherit",
          fontFamily: "inherit",
          textAlign: "start",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? DISABLED_OPACITY : 1,
          ...style,
        } as CSSProperties
      }
    >
      <span style={{ display: "grid", gap: "4px", minWidth: 0 }}>
        <span
          style={
            description
              ? { fontSize: "14px", fontWeight: 600, color: t.textPrimary }
              : { fontSize: "14px", color: t.textSecondary }
          }
        >
          {label}
        </span>
        {description && (
          <span
            id={descriptionId}
            style={{ fontSize: "13px", lineHeight: "19px", color: t.textSecondary }}
          >
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: "44px",
          height: "24px",
          boxSizing: "border-box",
          borderRadius: "999px",
          backgroundColor: value ? t.accent : t.inputBg,
          border: `1px solid ${value ? t.accent : t.inputBorder}`,
          transition: "background-color 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: value ? "22px" : "2px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            backgroundColor: value ? t.accentFg : t.textSecondary,
            transition: "left 0.2s",
          }}
        />
      </span>
    </button>
  );
}
