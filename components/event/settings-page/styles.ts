import type { ResolvedTheme } from "@/lib/theme";

// ── Styles ──────────────────────────────────────────────────────────────────

export function buildStyles(t: ResolvedTheme) {
  return {
    page: {
      minHeight: "100vh",
      background: t.pageBg,
      color: t.textPrimary,
      fontFamily: "inherit",
      paddingBottom: "120px",
      position: "relative" as const,
      overflowX: "hidden" as const,
    },
    container: {
      maxWidth: "600px",
      margin: "0 auto",
      padding: "110px 16px 80px",
      position: "relative" as const,
      zIndex: 1,
    },
    header: {
      position: "sticky" as const,
      top: "53px",
      background: t.cardBg,
      borderBottom: `1px solid ${t.cardBorder}`,
      padding: "12px 20px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      zIndex: 10,
      backdropFilter: "blur(14px)",
    },
    inp: {
      width: "100%",
      padding: "10px 14px",
      background: t.inputBg,
      border: `1px solid ${t.inputBorder}`,
      borderRadius: "10px",
      color: t.textPrimary,
      fontFamily: "inherit",
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box",
      colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
    } as React.CSSProperties,
    smallBtn: {
      padding: "8px 16px",
      background: t.accent,
      color: t.accentFg,
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "13px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    } as React.CSSProperties,
    av: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      background: t.avatarGradient,
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      fontSize: "13px",
      fontWeight: 700,
      color: t.accentFg,
      flexShrink: 0,
    },
  };
}

export type SettingsPageStyles = ReturnType<typeof buildStyles>;
