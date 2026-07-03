"use client";

import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsSection } from "./types";

export function SettingsMenu({
  isOwner,
  openSection,
  t,
}: {
  isOwner: boolean;
  openSection: (section: SettingsSection) => void;
  t: ResolvedTheme;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {(
        [
          ...(isOwner
            ? [
                {
                  id: "hosts" as const,
                  title: "👥 Hosts & Co-hosts",
                  desc: "Manage who can edit this event",
                },
              ]
            : []),
          {
            id: "privacy",
            title: "🔒 Display Options",
            desc: "Guest list visibility, password, and public settings",
          },
          {
            id: "rsvp",
            title: "✉️ RSVP Options",
            desc: "+1 settings, RSVP approval, and maybe options",
          },
          { id: "theme", title: "🎨 Theme", desc: "Change base theme and accent color" },
          {
            id: "reminders",
            title: "🔔 Auto-Reminders",
            desc: "Set up automatic emails and texts before/after event",
          },
          { id: "polls", title: "📊 Polls", desc: "Create and manage polls for guests" },
          {
            id: "questionnaire",
            title: "📋 Questionnaire",
            desc: "Ask custom questions to guests during RSVP",
          },
          {
            id: "potluck",
            title: "🍽️ Potluck",
            desc: "Manage items guests can sign up to bring",
          },
        ] as {
          id: SettingsSection;
          title: string;
          desc: string;
        }[]
      ).map((sec) => (
        <button
          key={sec.id}
          onClick={() => openSection(sec.id)}
          style={{
            textAlign: "left",
            background: t.cardBg,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: t.cardRadius,
            padding: "20px",
            boxShadow: t.cardShadow,
            backdropFilter: "blur(12px)",
            cursor: "pointer",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            transition: "all 0.15s ease-in-out",
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: t.textPrimary,
                margin: "0 0 4px",
              }}
            >
              {sec.title}
            </h3>
            <p style={{ fontSize: "13px", color: t.textMuted, margin: 0 }}>{sec.desc}</p>
          </div>
          <span style={{ fontSize: "18px", color: t.textMuted }}>➔</span>
        </button>
      ))}
    </div>
  );
}
