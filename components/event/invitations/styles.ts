import type { CSSProperties } from "react";
import { APP_SHELL, APP_SHELL_THEME, type ResolvedTheme } from "@/lib/theme";

// Layout pieces of the invite composer. Buttons and fields come from components/ui.
// The composer sits in a HostBar dialog, which is app chrome, so `t` is the bar's
// chromeTheme(): the dark shell carrying the event's accent.

export const DEFAULT_INVITE_THEME = APP_SHELL_THEME;

export const mutedText = (t: ResolvedTheme): CSSProperties => ({
  color: t.textSecondary,
  fontSize: "13px",
});

export const problemText = (t: ResolvedTheme): CSSProperties => ({
  margin: 0,
  color: t.status.error.text,
});

export const panelStyle = (t: ResolvedTheme): CSSProperties => ({
  display: "grid",
  gap: "10px",
  padding: "14px",
  border: `1px solid ${t.inputBorder}`,
  borderRadius: "12px",
});

/** Sticky action bar at the bottom of the dialog's scroll area. */
export const footerStyle = (t: ResolvedTheme): CSSProperties => ({
  position: "sticky",
  bottom: "-24px",
  margin: "0 -24px -24px",
  padding: "14px 24px 18px",
  background: APP_SHELL.chromeSurface,
  borderTop: `1px solid ${t.inputBorder}`,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
});
