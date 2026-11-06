import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { isDarkTheme, type ResolvedTheme } from "@/lib/theme";

/**
 * The one button set (docs/engineering/design-language.md, Components → Buttons).
 * Every button, and every link styled as a button, gets its look from here so two
 * buttons that look alike are always the same definition.
 *
 * - primary: the form's main action. `accent` fill, `accentFg` text, 44px.
 * - secondary: everything else. `inputBg` fill, `inputBorder` border, 40px.
 * - destructive: secondary shape in the theme's error colors (behind a confirm).
 * - add: "+ Add …" where something can be added (a dashed `accentBorder` outline
 *   with `accentText`); put a Plus icon before the label.
 * - link: an inline text action in `accentText`.
 * - icon: a 40px square with an accessible name.
 * - overlay: a control laid on a photo (cover image, event card): dark glass with white
 *   text, the same on every theme because the photo, not the theme, is underneath.
 *
 * `size="sm"` (32px) is only for actions inside a list or table row, or on a photo.
 */
export type ButtonVariant =
  "primary" | "secondary" | "destructive" | "add" | "link" | "icon" | "overlay";
export type ButtonSize = "md" | "sm";

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  /**
   * For a link placed straight on the page ground (outside any card), such as "← Back to
   * event" above a page title: it reads `heroTextSecondary`, which is checked against the
   * ground, instead of `accentText`, which is checked against cards.
   */
  onGround?: boolean;
}

export const DISABLED_OPACITY = 0.45;

const HEIGHT: Record<ButtonVariant, Record<ButtonSize, number>> = {
  primary: { md: 44, sm: 32 },
  secondary: { md: 40, sm: 32 },
  destructive: { md: 40, sm: 32 },
  add: { md: 40, sm: 32 },
  overlay: { md: 40, sm: 32 },
  icon: { md: 40, sm: 32 },
  link: { md: 24, sm: 24 },
};

type StyleWithVars = CSSProperties & Record<`--${string}`, string>;

/** The hover wash laid over a fill: light on dark fills, dark on light ones. */
function hoverWash(onDarkFill: boolean): string {
  return onDarkFill ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
}

export function buttonStyle(
  t: ResolvedTheme,
  {
    variant = "secondary",
    size = "md",
    disabled = false,
    fullWidth = false,
    onGround = false,
  }: ButtonLook = {}
): CSSProperties {
  const height = HEIGHT[variant][size];
  const base: StyleWithVars = {
    "--rsvp-focus": t.accent,
    "--rsvp-hover": hoverWash(isDarkTheme(t)),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxSizing: "border-box",
    minHeight: `${height}px`,
    width: fullWidth ? "100%" : undefined,
    margin: 0,
    // Every variant sets the whole `border`; mixing it with borderColor makes React warn.
    border: "1px solid transparent",
    borderRadius: t.btnRadius,
    backgroundColor: "transparent",
    fontFamily: "inherit",
    fontSize: size === "sm" ? "13px" : "14px",
    fontWeight: 600,
    lineHeight: 1.25,
    textAlign: "center",
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? DISABLED_OPACITY : 1,
    transition: "background-color 0.15s, opacity 0.15s",
  };

  switch (variant) {
    case "primary":
      return {
        ...base,
        "--rsvp-hover": hoverWash(t.accentFg === "#ffffff"),
        padding: size === "sm" ? "0 14px" : "0 20px",
        backgroundColor: t.accent,
        color: t.accentFg,
        fontWeight: t.btnFontWeight as CSSProperties["fontWeight"],
        textTransform: t.btnTransform as CSSProperties["textTransform"],
        boxShadow: disabled ? "none" : t.accentShadow,
      } as StyleWithVars;
    case "secondary":
      return {
        ...base,
        padding: size === "sm" ? "0 12px" : "0 16px",
        border: `1px solid ${t.inputBorder}`,
        backgroundColor: t.inputBg,
        color: t.textPrimary,
      } as StyleWithVars;
    case "destructive":
      return {
        ...base,
        padding: size === "sm" ? "0 12px" : "0 16px",
        border: `1px solid ${t.status.error.border}`,
        backgroundColor: t.status.error.bg,
        color: t.status.error.text,
      } as StyleWithVars;
    case "add":
      // On the card surface even when placed on the page ground: accentText is made
      // readable on the card, not on a BOLD gradient.
      return {
        ...base,
        padding: size === "sm" ? "0 12px" : "0 16px",
        border: `1px dashed ${t.accentBorder}`,
        backgroundColor: t.cardBg,
        backdropFilter: "blur(12px)",
        color: t.accentText,
      } as StyleWithVars;
    case "overlay":
      return {
        ...base,
        "--rsvp-focus": "#ffffff",
        "--rsvp-hover": hoverWash(true),
        padding: size === "sm" ? "0 12px" : "0 16px",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "999px",
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        color: "#ffffff",
        fontSize: "13px",
      } as StyleWithVars;
    case "icon":
      return {
        ...base,
        width: `${height}px`,
        minWidth: `${height}px`,
        height: `${height}px`,
        padding: 0,
        color: t.textSecondary,
        flexShrink: 0,
      } as StyleWithVars;
    case "link":
      return {
        ...base,
        display: "inline",
        minHeight: undefined,
        padding: 0,
        border: "none",
        borderRadius: "4px",
        color: onGround ? t.heroTextSecondary : t.accentText,
        textShadow: onGround ? t.heroTextShadow : undefined,
        fontSize: "inherit",
        textAlign: "start",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
      } as StyleWithVars;
  }
}

/** Class and style for a button look, to spread on a `<button>`, `<a>` or `<Link>`. */
export function buttonProps(
  t: ResolvedTheme,
  look: ButtonLook = {}
): { className: string; style: CSSProperties } {
  const variant = look.variant ?? "secondary";
  return {
    className: variant === "link" ? "rsvp-control rsvp-link" : "rsvp-control rsvp-press",
    style: buttonStyle(t, look),
  };
}

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled">;

export type ButtonProps = NativeButtonProps & {
  theme: ResolvedTheme;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  onGround?: boolean;
} & (
    | { variant?: Exclude<ButtonVariant, "icon"> }
    // An icon button has no visible text, so it must carry its name.
    | { variant: "icon"; "aria-label": string }
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { theme, variant, size, disabled, fullWidth, onGround, className, style, ...rest },
  ref
) {
  const look = buttonProps(theme, { variant, size, disabled, fullWidth, onGround });
  return (
    <button
      ref={ref}
      disabled={disabled}
      {...rest}
      className={className ? `${look.className} ${className}` : look.className}
      style={{ ...look.style, ...style }}
    />
  );
});
