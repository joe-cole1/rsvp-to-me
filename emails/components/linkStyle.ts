import type { CSSProperties } from "react";
import type { EmailTheme } from "@/lib/email-theme";

/**
 * An accent-colored text link: the text in `linkColor` (the accent made
 * readable on the email surfaces) and the underline, the link's non-color cue,
 * in `linkUnderline` (the theme's own accent wherever it reads 3:1 on the body
 * and card). Links on the canvas below the card pass `onCanvas`, which
 * underlines in `linkColor`. Pair with `className="dm-link"` for dark mode.
 */
export function linkStyle(
  theme: EmailTheme,
  extra?: CSSProperties,
  onCanvas = false
): CSSProperties {
  return {
    color: theme.linkColor,
    textDecoration: "underline",
    textDecorationColor: onCanvas ? theme.linkColor : theme.linkUnderline,
    ...extra,
  };
}
