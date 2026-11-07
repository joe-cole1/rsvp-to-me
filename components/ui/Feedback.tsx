"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { ResolvedTheme, StatusKind } from "@/lib/theme";
import { Button } from "./Button";

/**
 * Status feedback (docs/engineering/design-language.md, Components → Alerts, Toast,
 * Status chip). Every color comes from the theme's `status` set.
 */

/** A status line next to the control that caused it. Errors are `role="alert"`. */
export function InlineAlert({
  theme,
  tone = "error",
  children,
  style,
}: {
  theme: ResolvedTheme;
  tone?: StatusKind;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const s = theme.status[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "16px",
        color: s.text,
        fontSize: "13px",
        lineHeight: "19px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** A small pill. Good states read `status.success`; everything else is neutral. */
export function StatusChip({
  theme,
  tone = "neutral",
  children,
}: {
  theme: ResolvedTheme;
  tone?: "success" | "neutral";
  children: ReactNode;
}) {
  const good = tone === "success";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "999px",
        backgroundColor: good ? theme.status.success.bg : theme.inputBg,
        color: good ? theme.status.success.text : theme.textSecondary,
        fontSize: "12px",
        fontWeight: 700,
        lineHeight: "18px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export interface ToastMessage {
  tone: Extract<StatusKind, "success" | "error" | "info">;
  message: string;
}

/**
 * The one toast, for a page-level result with no control to sit next to. Errors are
 * `role="alert"`, everything else `role="status"`. `action` adds one inline button
 * (for example, Undo).
 */
export function Toast({
  theme,
  toast,
  onDismiss,
  action,
}: {
  theme: ResolvedTheme;
  toast: ToastMessage | null;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const t = useTranslations("Ui.Common");
  if (!toast) return null;
  const s = theme.status[toast.tone];
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      style={{
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        width: "max-content",
        maxWidth: "calc(100% - 32px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "8px 8px 8px 16px",
          minHeight: "48px",
          boxSizing: "border-box",
          borderRadius: theme.cardRadius,
          border: `1px solid ${s.border}`,
          // The status wash over the card over the page ground: the surface the
          // theme's status text is made readable on.
          background: `linear-gradient(${s.bg}, ${s.bg}), linear-gradient(${theme.cardBg}, ${theme.cardBg}), ${theme.pageBg}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          color: s.text,
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        <span>{toast.message}</span>
        {action && (
          <Button theme={theme} variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {onDismiss && (
          <Button
            theme={theme}
            variant="icon"
            size="sm"
            aria-label={t("dismissNotification")}
            onClick={onDismiss}
            style={{ color: s.text }}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
