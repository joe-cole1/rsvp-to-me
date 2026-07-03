"use client";

import type { ResolvedTheme } from "@/lib/theme";

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

export function Toggle({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  t: ResolvedTheme;
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

export function Section({
  title,
  children,
  t,
}: {
  title: string;
  children: React.ReactNode;
  t: ResolvedTheme;
}) {
  return (
    <div
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: t.cardRadius,
        padding: "20px",
        marginBottom: "16px",
        boxShadow: t.cardShadow,
        backdropFilter: "blur(12px)",
      }}
    >
      <h2 style={{ fontSize: "15px", fontWeight: 700, color: t.textPrimary, marginBottom: "20px" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
