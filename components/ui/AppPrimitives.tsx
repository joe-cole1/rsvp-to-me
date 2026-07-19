"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { APP_SHELL } from "@/lib/theme";

export const appCardStyle: React.CSSProperties = {
  background: APP_SHELL.cardBg,
  border: `1px solid ${APP_SHELL.cardBorder}`,
  borderRadius: APP_SHELL.cardRadius,
};

export const appInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: APP_SHELL.inputBg,
  border: `1px solid ${APP_SHELL.inputBorder}`,
  borderRadius: APP_SHELL.inputRadius,
  color: APP_SHELL.textPrimary,
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  colorScheme: "dark",
};

export const appLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  color: APP_SHELL.textMuted,
  marginBottom: "8px",
};

export function AppCard({ children, style, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} style={{ ...appCardStyle, ...style }}>
      {children}
    </section>
  );
}

export function FormField({
  label,
  children,
  style,
}: {
  label: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "block", marginBottom: "16px", ...style }}>
      <span style={appLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

export const AppInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AppInput({ style, ...props }, ref) {
    return <input ref={ref} {...props} style={{ ...appInputStyle, ...style }} />;
  }
);

export function AppButton({
  children,
  style,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        padding: "12px 20px",
        background: APP_SHELL.accent,
        color: APP_SHELL.textPrimary,
        border: "none",
        borderRadius: APP_SHELL.btnRadius,
        fontFamily: "inherit",
        fontSize: "14px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function InlineAlert({
  children,
  tone = "error",
  style,
}: {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  style?: React.CSSProperties;
}) {
  const colors = {
    error: { color: "#fca5a5", border: "rgba(239,68,68,0.3)", bg: "rgba(239,68,68,0.15)" },
    success: { color: "#4ade80", border: "rgba(34,197,94,0.3)", bg: "rgba(34,197,94,0.12)" },
    info: { color: "#c084fc", border: "rgba(168,85,247,0.3)", bg: "rgba(168,85,247,0.1)" },
  }[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "16px",
        color: colors.color,
        fontSize: "13px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FeedbackToast({
  feedback,
  onDismiss,
}: {
  feedback: { type: "success" | "error"; message: string } | null;
  onDismiss: () => void;
}) {
  if (!feedback) return null;
  const color = feedback.type === "success" ? "#22c55e" : "#ef4444";

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss notification"
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        padding: "12px 20px",
        borderRadius: "12px",
        backgroundColor: APP_SHELL.cardBg,
        border: `1px solid ${color}`,
        color,
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.15)",
        fontSize: "14px",
        fontWeight: 600,
        backdropFilter: "blur(8px)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "90%",
        width: "max-content",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      <span aria-hidden="true">{feedback.type === "success" ? "✓" : "⚠️"}</span>
      <span>{feedback.message}</span>
    </button>
  );
}
