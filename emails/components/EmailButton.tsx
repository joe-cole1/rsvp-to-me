import type { EmailTheme } from "@/lib/email-theme";

/**
 * Padded-anchor button (react-email's "bulletproof" pattern). `primary` uses
 * the event accent; `quiet` is a low-emphasis outline for secondary choices.
 */
export function EmailButton({
  theme,
  href,
  variant = "primary",
  children,
}: {
  theme: EmailTheme;
  href: string;
  variant?: "primary" | "quiet";
  children: string;
}) {
  const base = {
    display: "inline-block",
    borderRadius: theme.btnRadius,
    fontWeight: theme.btnFontWeight,
    textTransform: theme.btnTransform as "uppercase" | "none",
    fontSize: "15px",
    textDecoration: "none",
    padding: "12px 26px",
  };
  const style =
    variant === "primary"
      ? { ...base, backgroundColor: theme.accent, color: theme.accentFg }
      : {
          ...base,
          backgroundColor: theme.bodyBg,
          color: theme.accent,
          border: `1px solid ${theme.accentBorder}`,
          padding: "11px 25px",
        };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={style}>
      {children}
    </a>
  );
}
