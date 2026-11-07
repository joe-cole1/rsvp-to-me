"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { isDarkTheme, type ResolvedTheme } from "@/lib/theme";
import { Button, DISABLED_OPACITY } from "./Button";

/**
 * The one field set (docs/engineering/design-language.md, Components → Fields): a
 * label in `textSecondary`, the control in the theme's input colors, an optional
 * hint and an error. `Field` ties the hint and error to the control it wraps.
 */

type StyleWithVars = CSSProperties & Record<`--${string}`, string>;

/** The input look shared by text inputs, textareas and selects. */
export function fieldStyle(t: ResolvedTheme, disabled?: boolean): CSSProperties {
  return {
    "--rsvp-focus": t.accent,
    "--rsvp-placeholder": t.inputPlaceholder,
    display: "block",
    width: "100%",
    minWidth: 0,
    minHeight: "40px",
    boxSizing: "border-box",
    margin: 0,
    padding: "10px 14px",
    backgroundColor: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: "10px",
    color: t.inputText,
    fontFamily: "inherit",
    fontSize: "14px",
    lineHeight: 1.4,
    colorScheme: isDarkTheme(t) ? "dark" : "light",
    opacity: disabled ? DISABLED_OPACITY : 1,
    cursor: disabled ? "not-allowed" : undefined,
  } as StyleWithVars;
}

export const FIELD_CLASS = "rsvp-control rsvp-field";

export function labelStyle(t: ResolvedTheme): CSSProperties {
  return {
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: t.textSecondary,
    marginBottom: "8px",
  };
}

/** A 12px bold label. With `htmlFor` it is a real `<label>`; without, a group heading. */
export function Label({
  theme,
  htmlFor,
  id,
  children,
  style,
}: {
  theme: ResolvedTheme;
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const s = { ...labelStyle(theme), ...style };
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} style={s}>
      {children}
    </label>
  ) : (
    <div id={id} style={s}>
      {children}
    </div>
  );
}

const FieldContext = createContext<{ describedBy?: string; invalid: boolean } | null>(null);

function useFieldAria(own: { "aria-describedby"?: string; "aria-invalid"?: unknown }) {
  const field = useContext(FieldContext);
  const describedBy =
    [own["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    "aria-describedby": describedBy,
    "aria-invalid": (own["aria-invalid"] as boolean | undefined) ?? (field?.invalid || undefined),
  };
}

/**
 * A label, the control passed as children, an optional hint and an optional error.
 * The label wraps the control so they stay tied; hint and error are described-by.
 */
export function Field({
  theme,
  label,
  hint,
  error,
  children,
  style,
}: {
  theme: ResolvedTheme;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ marginBottom: "16px", ...style }}>
      <label style={{ display: "block" }}>
        <span style={labelStyle(theme)}>{label}</span>
        <FieldContext.Provider value={{ describedBy, invalid: Boolean(error) }}>
          {children}
        </FieldContext.Provider>
      </label>
      {hint && (
        <p
          id={hintId}
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            lineHeight: "19px",
            color: theme.textSecondary,
          }}
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            lineHeight: "19px",
            color: theme.status.error.text,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

type Themed<T> = T & { theme: ResolvedTheme };

export const Input = forwardRef<HTMLInputElement, Themed<InputHTMLAttributes<HTMLInputElement>>>(
  function Input({ theme, className, style, ...rest }, ref) {
    const aria = useFieldAria(rest);
    return (
      <input
        ref={ref}
        {...rest}
        {...aria}
        className={className ? `${FIELD_CLASS} ${className}` : FIELD_CLASS}
        style={{ ...fieldStyle(theme, rest.disabled), ...style }}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  Themed<TextareaHTMLAttributes<HTMLTextAreaElement>>
>(function Textarea({ theme, className, style, ...rest }, ref) {
  const aria = useFieldAria(rest);
  return (
    <textarea
      ref={ref}
      {...rest}
      {...aria}
      className={className ? `${FIELD_CLASS} ${className}` : FIELD_CLASS}
      style={{ ...fieldStyle(theme, rest.disabled), resize: "vertical", ...style }}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  Themed<SelectHTMLAttributes<HTMLSelectElement>>
>(function Select({ theme, className, style, ...rest }, ref) {
  const aria = useFieldAria(rest);
  return (
    <select
      ref={ref}
      {...rest}
      {...aria}
      className={className ? `${FIELD_CLASS} ${className}` : FIELD_CLASS}
      style={{
        ...fieldStyle(theme, rest.disabled),
        cursor: rest.disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    />
  );
});

/** A password-style input with a show/hide icon button inside its right edge. */
export function SecretInput({
  theme,
  showLabel,
  hideLabel,
  style,
  ...rest
}: Themed<Omit<InputHTMLAttributes<HTMLInputElement>, "type">> & {
  showLabel: string;
  hideLabel: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <Input
        theme={theme}
        type={shown ? "text" : "password"}
        {...rest}
        style={{ paddingRight: "48px", ...style }}
      />
      <Button
        theme={theme}
        variant="icon"
        size="sm"
        type="button"
        aria-label={shown ? hideLabel : showLabel}
        aria-pressed={shown}
        title={shown ? hideLabel : showLabel}
        onClick={() => setShown((s) => !s)}
        style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)" }}
      >
        {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </Button>
    </div>
  );
}

/**
 * A color picker shaped like a field: a sample, the hex value, and the native picker
 * laid invisibly over the whole field so a click anywhere opens it.
 */
export function ColorInput({
  theme,
  value,
  onChange,
  label,
  style,
}: {
  theme: ResolvedTheme;
  value: string;
  onChange: (value: string) => void;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <label
      className="rsvp-field-within"
      style={{
        ...fieldStyle(theme),
        display: "flex",
        alignItems: "center",
        gap: "8px",
        position: "relative",
        cursor: "pointer",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "5px",
          background: value,
          border: `1px solid ${theme.inputBorder}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "13px", color: theme.textSecondary, fontFamily: "monospace" }}>
        {value}
      </span>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      />
    </label>
  );
}

/** A native slider in the theme's accent, with a visible focus ring. */
export const Range = forwardRef<
  HTMLInputElement,
  Themed<Omit<InputHTMLAttributes<HTMLInputElement>, "type">>
>(function Range({ theme, className, style, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="range"
      {...rest}
      className={className ? `rsvp-control ${className}` : "rsvp-control"}
      style={
        {
          "--rsvp-focus": theme.accent,
          accentColor: theme.accent,
          flex: 1,
          minWidth: 0,
          margin: 0,
          cursor: rest.disabled ? "not-allowed" : "pointer",
          ...style,
        } as StyleWithVars
      }
    />
  );
});

/** A native checkbox or radio in the theme's accent, with a visible focus ring. */
export const Check = forwardRef<
  HTMLInputElement,
  Themed<Omit<InputHTMLAttributes<HTMLInputElement>, "type">> & { type?: "checkbox" | "radio" }
>(function Check({ theme, className, style, type = "checkbox", ...rest }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      {...rest}
      className={className ? `rsvp-control ${className}` : "rsvp-control"}
      style={
        {
          "--rsvp-focus": theme.accent,
          accentColor: theme.accent,
          width: "18px",
          height: "18px",
          margin: 0,
          flexShrink: 0,
          cursor: rest.disabled ? "not-allowed" : "pointer",
          opacity: rest.disabled ? DISABLED_OPACITY : 1,
          ...style,
        } as StyleWithVars
      }
    />
  );
});
