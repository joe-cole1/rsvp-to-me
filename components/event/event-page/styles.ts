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
  };
}

export type EventPageStyles = ReturnType<typeof buildStyles>;
