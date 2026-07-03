"use client";

import { X } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import type { CoHostEntry, EventInput } from "./types";
import type { SettingsPageStyles } from "./styles";
import { Section } from "./ui";

export function HostsPanel({
  event,
  coHosts,
  cohostEmail,
  setCohostEmail,
  cohostError,
  handleAddCohost,
  handleRemoveCohost,
  isPending,
  t,
  S,
}: {
  event: EventInput;
  coHosts: CoHostEntry[];
  cohostEmail: string;
  setCohostEmail: React.Dispatch<React.SetStateAction<string>>;
  cohostError: string | null;
  handleAddCohost: () => void;
  handleRemoveCohost: (cohostRecordId: string) => void;
  isPending: boolean;
  t: ResolvedTheme;
  S: SettingsPageStyles;
}) {
  return (
    <Section title="Hosts" t={t}>
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 0",
            borderBottom: `1px solid ${t.cardBorder}`,
          }}
        >
          <div style={S.av}>{event.slug[0]?.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>You</div>
            <div style={{ fontSize: "12px", color: t.textMuted }}>Host</div>
          </div>
        </div>
        {coHosts.map((ch) => (
          <div
            key={ch.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 0",
              borderBottom: `1px solid ${t.cardBorder}`,
            }}
          >
            <div style={S.av}>{(ch.user.name ?? ch.user.email)[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                {ch.user.name ?? ch.user.email}
              </div>
              <div style={{ fontSize: "12px", color: t.textMuted }}>{ch.user.email} · Co-host</div>
            </div>
            <button
              onClick={() => handleRemoveCohost(ch.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textMuted,
                padding: "4px",
              }}
              title="Remove co-host"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={cohostEmail}
          onChange={(e) => setCohostEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddCohost();
          }}
          placeholder="cohost@email.com"
          style={{ ...S.inp, flex: 1 }}
        />
        <button
          onClick={handleAddCohost}
          disabled={isPending || !cohostEmail.trim()}
          style={S.smallBtn}
        >
          Add
        </button>
      </div>
      {cohostError && (
        <div style={{ fontSize: "13px", color: "#f87171", marginTop: "8px" }}>{cohostError}</div>
      )}
    </Section>
  );
}
