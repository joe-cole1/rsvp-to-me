import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from "react";
import { Palette } from "lucide-react";
import { isDarkTheme, type ResolvedTheme } from "@/lib/theme";
import { DISABLED_OPACITY } from "./Button";

/**
 * Pressable choices (docs/engineering/design-language.md, Components → Choices).
 * Each one is a `<button aria-pressed>`:
 *
 * - Chip: a pill for filters and short either/or choices (Theme · Effects · Font,
 *   density, speed). Selected reads `accentBg` with `accentText`.
 * - ChoiceTile: a tile in a picker grid (presets, fonts, effects, base themes, icons).
 *   Selected reads `accentBg` with a 2px `accent` border.
 * - Swatch: a round color sample with the color's name as its accessible name.
 *
 * Callers may pass `style` for layout only (width, padding, grid placement), never
 * for colors.
 */
type ChoiceProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  theme: ResolvedTheme;
  selected: boolean;
};

type StyleWithVars = CSSProperties & Record<`--${string}`, string>;

function pressable(t: ResolvedTheme, disabled: boolean | undefined): StyleWithVars {
  return {
    "--rsvp-focus": t.accent,
    "--rsvp-hover": isDarkTheme(t) ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    boxSizing: "border-box",
    margin: 0,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? DISABLED_OPACITY : 1,
    transition: "background-color 0.15s, border-color 0.15s, color 0.15s",
  };
}

export function chipStyle(t: ResolvedTheme, selected: boolean, disabled?: boolean): CSSProperties {
  return {
    ...pressable(t, disabled),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minHeight: "32px",
    padding: "0 12px",
    borderRadius: "999px",
    border: `1px solid ${selected ? t.accent : t.inputBorder}`,
    // Chips also sit on the page ground (guest-list and dashboard filters), so they carry
    // the card surface their text is checked against; the selected wash lies over it.
    backgroundColor: t.cardBg,
    boxShadow: selected ? `inset 0 0 0 999px ${t.accentBg}` : "none",
    backdropFilter: "blur(12px)",
    color: selected ? t.accentText : t.textSecondary,
    fontSize: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

export function choiceTileStyle(
  t: ResolvedTheme,
  selected: boolean,
  disabled?: boolean
): CSSProperties {
  return {
    ...pressable(t, disabled),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "10px",
    borderRadius: "10px",
    border: `2px solid ${selected ? t.accent : t.inputBorder}`,
    backgroundColor: selected ? t.accentBg : t.inputBg,
    color: t.textPrimary,
    fontSize: "13px",
    textAlign: "center",
  };
}

export const Chip = forwardRef<HTMLButtonElement, ChoiceProps>(function Chip(
  { theme, selected, disabled, className, style, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      disabled={disabled}
      {...rest}
      className={["rsvp-control rsvp-press", className].filter(Boolean).join(" ")}
      style={{ ...chipStyle(theme, selected, disabled), ...style }}
    />
  );
});

export const ChoiceTile = forwardRef<HTMLButtonElement, ChoiceProps>(function ChoiceTile(
  { theme, selected, disabled, className, style, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      disabled={disabled}
      {...rest}
      className={["rsvp-control rsvp-press", className].filter(Boolean).join(" ")}
      style={{ ...choiceTileStyle(theme, selected, disabled), ...style }}
    />
  );
});

/**
 * The "any color" swatch at the end of a swatch row: a native color picker in a circle.
 * It shows the chosen color, and the selected ring, when no preset swatch matches.
 */
export function CustomSwatch({
  theme,
  value,
  selected,
  label,
  onChange,
}: {
  theme: ResolvedTheme;
  value: string;
  selected: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      title={label}
      className="rsvp-field-within"
      style={
        {
          "--rsvp-focus": theme.accent,
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          boxSizing: "border-box",
          borderRadius: "50%",
          overflow: "hidden",
          cursor: "pointer",
          backgroundColor: selected ? value : theme.inputBg,
          border: `3px ${selected ? "solid" : "dashed"} ${selected ? theme.textPrimary : theme.inputBorder}`,
          color: theme.textSecondary,
          flexShrink: 0,
        } as CSSProperties
      }
    >
      {!selected && <Palette size={14} aria-hidden="true" />}
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
      />
    </label>
  );
}

/** A round color sample. `label` names the color for assistive technology. */
export function Swatch({
  theme,
  color,
  label,
  selected,
  onClick,
  disabled,
}: {
  theme: ResolvedTheme;
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className="rsvp-control"
      style={{
        ...pressable(theme, disabled),
        width: "32px",
        height: "32px",
        padding: 0,
        borderRadius: "50%",
        backgroundColor: color,
        border: `3px solid ${selected ? theme.textPrimary : "transparent"}`,
        boxShadow: selected ? `0 0 0 2px ${color}` : "none",
        flexShrink: 0,
      }}
    />
  );
}
