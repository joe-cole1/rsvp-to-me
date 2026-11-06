import type { ButtonHTMLAttributes } from "react";
import { isDarkTheme, type ResolvedTheme } from "@/lib/theme";

/**
 * One entry in a vertical section list (the admin sidebar and drawer, the docs index).
 * The current entry is an `accent` fill with `accentFg` text and `aria-current`.
 */
export function NavItem({
  theme: t,
  active,
  style,
  className,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-current"> & {
  theme: ResolvedTheme;
  active: boolean;
}) {
  return (
    <button
      type={type}
      aria-current={active ? "true" : undefined}
      {...rest}
      className={["rsvp-control rsvp-press", className].filter(Boolean).join(" ")}
      style={
        {
          "--rsvp-focus": t.accent,
          "--rsvp-hover": active
            ? "transparent"
            : isDarkTheme(t)
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.05)",
          display: "block",
          width: "100%",
          boxSizing: "border-box",
          minHeight: "40px",
          padding: "10px 14px",
          border: "none",
          borderRadius: "12px",
          backgroundColor: active ? t.accent : "transparent",
          color: active ? t.accentFg : t.textSecondary,
          fontFamily: "inherit",
          fontSize: "14px",
          fontWeight: active ? 700 : 600,
          textAlign: "start",
          cursor: "pointer",
          transition: "background-color 0.15s, color 0.15s",
          ...style,
        } as React.CSSProperties
      }
    />
  );
}
