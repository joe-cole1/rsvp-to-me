import type { ReactNode } from "react";
import type { ResolvedTheme } from "@/lib/theme";
import { guestCountLabel, type GuestStatusDisplay } from "@/lib/guestRsvpDisplay";

export function GuestRsvpGroup({
  label,
  count,
  display,
  t,
  children,
}: {
  label: string;
  count: number;
  display: GuestStatusDisplay;
  t: ResolvedTheme;
  children: ReactNode;
}) {
  if (display.list === "HIDDEN") return null;
  const countLabel = guestCountLabel(count, display);
  const heading = `${label}${countLabel === null ? "" : ` · ${countLabel}`}`;
  const headingStyle = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: t.textMuted,
    marginBottom: "8px",
  };

  return display.list === "COLLAPSED" ? (
    <details style={{ marginBottom: "14px" }}>
      <summary style={{ ...headingStyle, cursor: "pointer" }}>{heading}</summary>
      {children}
    </details>
  ) : (
    <div style={{ marginBottom: "14px" }}>
      <div style={headingStyle}>{heading}</div>
      {children}
    </div>
  );
}
