"use client";

import type { ResolvedTheme } from "@/lib/theme";

export const RSVP_RESPONSE_STATUSES = ["GOING", "MAYBE", "NO"] as const;
export type RsvpResponseStatus = (typeof RSVP_RESPONSE_STATUSES)[number];

export const RSVP_STATUS_LABELS: Record<RsvpResponseStatus, string> = {
  GOING: "Going",
  MAYBE: "Maybe",
  NO: "Can't go",
};

export const RSVP_STATUS_EMOJIS: Record<RsvpResponseStatus, string> = {
  GOING: "🎉",
  MAYBE: "🤔",
  NO: "😔",
};

export function RsvpStatusChoice({
  status,
  theme: t,
  active = false,
  href,
  onClick,
  disabled = false,
}: {
  status: RsvpResponseStatus;
  theme: ResolvedTheme;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const style: React.CSSProperties = {
    flex: 1,
    padding: "14px 8px",
    border: active ? "1px solid transparent" : `1px solid ${t.inputBorder}`,
    borderRadius: t.btnRadius,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 700,
    background: active ? t.accent : t.inputBg,
    color: active ? t.accentFg : t.textSecondary,
    boxShadow: active ? t.accentShadow : "none",
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    opacity: disabled ? 0.6 : 1,
  };
  const content = (
    <>
      <span aria-hidden="true" style={{ fontSize: "22px" }}>
        {RSVP_STATUS_EMOJIS[status]}
      </span>
      {RSVP_STATUS_LABELS[status]}
    </>
  );

  if (href) {
    return (
      <a href={href} style={style} aria-current={active ? "true" : undefined}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} style={style}>
      {content}
    </button>
  );
}
