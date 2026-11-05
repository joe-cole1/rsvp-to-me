"use client";

import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "@/components/event/event-page/EventCard";

// ── Shared UI primitives ───────────────────────────────────────────────────────

export function Label({ children, t }: { children: React.ReactNode; t: ResolvedTheme }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "none",
        letterSpacing: "0.02em",
        color: t.textMuted,
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

/** An immediate on/off switch. */
export function Toggle({
  label,
  value,
  onChange,
  t,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  t: ResolvedTheme;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "12px",
      }}
    >
      <span style={{ fontSize: "14px", color: t.textSecondary }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "100px",
          cursor: "pointer",
          background: value ? t.accent : t.inputBg,
          border: `1px solid ${t.inputBorder}`,
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: value ? "23px" : "3px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: value ? t.accentFg : t.textSecondary,
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

/** A settings card. `action` sits at the right of the title (for example, an Add button). */
export function Section({
  title,
  children,
  t,
  action,
}: {
  title: string;
  children: React.ReactNode;
  t: ResolvedTheme;
  action?: React.ReactNode;
}) {
  const heading = (
    <h2
      style={{
        fontSize: "15px",
        fontWeight: 700,
        color: t.textPrimary,
        marginBottom: action ? 0 : "20px",
      }}
    >
      {title}
    </h2>
  );
  return (
    <EventCard
      theme={t}
      style={{
        padding: "20px",
      }}
    >
      {action ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {children}
    </EventCard>
  );
}
