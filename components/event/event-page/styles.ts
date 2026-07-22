import type { ResolvedTheme } from "@/lib/theme";

// ── Styles ──────────────────────────────────────────────────────────────────

export function buildStyles(t: ResolvedTheme) {
  return {
    page: {
      minHeight: "100vh",
      background: t.pageBg,
      color: t.textPrimary,
      position: "relative" as const,
      overflowX: "hidden" as const,
      fontFamily: "inherit",
    },
    container: {
      position: "relative" as const,
      zIndex: 1,
      maxWidth: "600px",
      margin: "0 auto",
      padding: "96px 16px 160px",
    },
    inp: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: t.btnRadius,
      background: t.inputBg,
      border: `1px solid ${t.inputBorder}`,
      color: t.inputText,
      fontFamily: "inherit",
      fontSize: "14px",
      outline: "none",
    },
    btn: {
      background: t.accent,
      color: t.accentFg,
      fontFamily: "inherit",
      fontSize: "14px",
      fontWeight: t.btnFontWeight,
      textTransform: t.btnTransform as React.CSSProperties["textTransform"],
      padding: "14px",
      border: "none",
      borderRadius: t.btnRadius,
      cursor: "pointer",
      width: "100%",
      boxShadow: t.accentShadow,
    },
    mutedBtn: {
      background: t.inputBg,
      color: t.textSecondary,
      fontFamily: "inherit",
      fontSize: "13px",
      fontWeight: 600,
      padding: "10px 16px",
      border: `1px solid ${t.inputBorder}`,
      borderRadius: t.btnRadius,
      cursor: "pointer",
    },
  };
}

export type EventPageStyles = ReturnType<typeof buildStyles>;
