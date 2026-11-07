"use client";

import { useTranslations } from "next-intl";

import type { ResolvedTheme } from "@/lib/theme";
import type { SettingsSection } from "./types";

export function SettingsMenu({
  isOwner,
  openSection,
  t,
  emailEnabled = true,
}: {
  isOwner: boolean;
  openSection: (section: SettingsSection) => void;
  t: ResolvedTheme;
  emailEnabled?: boolean;
}) {
  const translate = useTranslations("Ui.Event.SettingsMenu");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {(
        [
          {
            id: "hosts" as const,
            title: translate("hostsCoHosts"),
            desc: isOwner
              ? translate("manageWhoCanEditEvent")
              : translate("viewHostsManageCoHostProfile"),
          },
          {
            id: "privacy",
            title: translate("displayOptions"),
            desc: translate("guestListAccessGuestRsvpDisplay"),
          },
          {
            id: "rsvp",
            title: translate("rsvpOptions"),
            desc: translate("1SettingsRsvpApprovalMaybeOptions"),
          },
          { id: "theme", title: translate("theme"), desc: translate("changeBaseThemeAccentColor") },
          {
            id: "reminders",
            title: translate("autoReminders"),
            desc: translate("setUpAutomaticEmailsTextsBefore"),
          },
          ...(emailEnabled
            ? [
                {
                  id: "emails" as const,
                  title: translate("emails"),
                  desc: translate("previewEventSThemedEmailsSend"),
                },
              ]
            : []),
          { id: "polls", title: translate("polls"), desc: translate("createManagePollsGuests") },
          {
            id: "questionnaire",
            title: translate("questionnaire"),
            desc: translate("askCustomQuestionsGuestsDuringRsvp"),
          },
          {
            id: "potluck",
            title: translate("potluck"),
            desc: translate("manageItemsGuestsCanSignUp"),
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
          className="rsvp-control"
          style={{
            ["--rsvp-focus" as string]: t.accent,
            textAlign: "left",
            fontFamily: "inherit",
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
