"use client";

import type { ResolvedTheme } from "@/lib/theme";
import { ICON_SET } from "./helpers";

// ── Icon picker strip ──────────────────────────────────────────────────────────

export function IconPicker({
  selected,
  onSelect,
  t,
}: {
  selected: string;
  onSelect: (key: string) => void;
  t: ResolvedTheme;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        overflowX: "auto",
        paddingBottom: "10px",
        marginBottom: "4px",
      }}
    >
      {ICON_SET.map(({ key, icon: IconComp }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          title={ICON_SET.find((i) => i.key === key)?.label}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: selected === key ? t.accentBg : t.inputBg,
            border: selected === key ? `2px solid ${t.accent}` : "2px solid transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
          }}
        >
          <IconComp size={16} style={{ color: selected === key ? t.accent : t.textMuted }} />
        </button>
      ))}
    </div>
  );
}
