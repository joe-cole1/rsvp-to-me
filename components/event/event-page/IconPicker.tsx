"use client";

import { useTranslations } from "next-intl";
import type { ResolvedTheme } from "@/lib/theme";
import { ICON_SET } from "./helpers";
import { ChoiceTile } from "@/components/ui/Choice";

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
  const shared = useTranslations("Ui.Event.shared");
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
        <ChoiceTile
          key={key}
          theme={t}
          selected={selected === key}
          onClick={() => onSelect(key)}
          title={shared("icons." + key)}
          aria-label={shared("icons." + key)}
          style={{ width: "40px", height: "40px", padding: 0, borderRadius: "50%", flexShrink: 0 }}
        >
          <IconComp
            size={16}
            aria-hidden="true"
            style={{ color: selected === key ? t.accent : t.textSecondary }}
          />
        </ChoiceTile>
      ))}
    </div>
  );
}
