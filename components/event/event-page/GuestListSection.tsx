"use client";

import { useTranslations } from "next-intl";

import { Settings, Users } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { GuestRsvpGroup } from "../GuestRsvpGroup";
import {
  isGuestRowShown,
  resolveGuestRsvpDisplay,
  showGuestResponseTotal,
} from "@/lib/guestRsvpDisplay";

export function GuestListSection({
  event,
  renderAvatar,
  t,
  isHost,
  going,
  maybe,
  no,
  totalGoing,
}: {
  event: EventData;
  renderAvatar: (
    name: string,
    rsvpId?: string | null,
    customStyle?: React.CSSProperties
  ) => React.ReactNode;
  t: ResolvedTheme;
  isHost: boolean;
  going: EventData["rsvps"];
  maybe: EventData["rsvps"];
  no: EventData["rsvps"];
  totalGoing: number;
}) {
  const translate = useTranslations("Ui.Event.GuestListSection");

  const display = resolveGuestRsvpDisplay(event, isHost);
  const showTotal = showGuestResponseTotal(display);
  const invitedGuests = event.invitedGuests ?? [];
  const invitedCount = event.invitedCount ?? 0;
  const showInvited =
    isGuestRowShown(display.INVITED) && (invitedGuests.length > 0 || invitedCount > 0);
  const hasVisibleRsvps =
    showInvited ||
    event.rsvps.some((r) => (display[r.status] ? isGuestRowShown(display[r.status]) : true));
  return (
    <>
      {/* ── Guest List ── */}
      {(isHost || (event.guestListVis === "ALL" && hasVisibleRsvps)) && (
        <EventCard theme={t}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={16} style={{ color: t.accent }} />
              <span style={{ fontWeight: 700 }}>
                {translate("guests")}
                {showTotal ? ` (${event.rsvps.length})` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <a
                href={`/e/${event.slug}/guests`}
                style={{
                  fontSize: "13px",
                  color: t.accentText,
                  textDecoration: "none",
                }}
              >
                {translate("viewAll")}
              </a>
              {isHost && (
                <a
                  href={`/e/${event.slug}/settings?section=rsvp`}
                  aria-label={translate("rsvpSettings")}
                  title={translate("rsvpSettings")}
                  style={{ color: t.textMuted, display: "flex", alignItems: "center" }}
                >
                  <Settings size={13} />
                </a>
              )}
            </div>
          </div>
          {going.length > 0 && (
            <GuestRsvpGroup
              label={translate("going")}
              count={totalGoing}
              display={display.GOING}
              t={t}
            >
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                {going.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: r.note ? "flex-start" : "center",
                      gap: "8px",
                      padding: "6px 12px",
                      borderRadius: "14px",
                      background: t.pillBg,
                      border: `1px solid ${t.pillBorder}`,
                      fontSize: "13px",
                    }}
                  >
                    {renderAvatar(r.guestName, r.id, {
                      width: "20px",
                      height: "20px",
                      fontSize: "10px",
                      minWidth: "20px",
                      marginTop: r.note ? "2px" : 0,
                    })}
                    <div>
                      <div>
                        {r.guestName}
                        {r.plusOneCount > 0 && ` +${r.plusOneCount}`}
                      </div>
                      {r.note && (
                        <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "2px" }}>
                          {r.note}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GuestRsvpGroup>
          )}
          {maybe.length > 0 && (
            <GuestRsvpGroup
              label={translate("maybe")}
              count={maybe.length}
              display={display.MAYBE}
              t={t}
            >
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                {maybe.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      borderRadius: "14px",
                      background: t.pillBg,
                      border: `1px solid ${t.pillBorder}`,
                      fontSize: "13px",
                      opacity: 0.75,
                    }}
                  >
                    {renderAvatar(r.guestName, r.id, {
                      width: "20px",
                      height: "20px",
                      fontSize: "10px",
                      minWidth: "20px",
                    })}
                    <span>
                      {r.guestName}
                      {r.plusOneCount > 0 && ` +${r.plusOneCount}`}
                    </span>
                  </div>
                ))}
              </div>
            </GuestRsvpGroup>
          )}
          {no.length > 0 && (
            <GuestRsvpGroup
              label={translate("canTMake")}
              count={no.length}
              display={display.NO}
              t={t}
            >
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                {no.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      borderRadius: "14px",
                      background: t.pillBg,
                      border: `1px solid ${t.pillBorder}`,
                      fontSize: "13px",
                      opacity: 0.45,
                    }}
                  >
                    {renderAvatar(r.guestName, r.id, {
                      width: "20px",
                      height: "20px",
                      fontSize: "10px",
                      minWidth: "20px",
                    })}
                    <span>{r.guestName}</span>
                  </div>
                ))}
              </div>
            </GuestRsvpGroup>
          )}
          {showInvited && (
            <GuestRsvpGroup
              label={translate("invited")}
              count={invitedCount}
              display={display.INVITED}
              t={t}
            >
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                {invitedGuests.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      borderRadius: "14px",
                      background: t.pillBg,
                      border: `1px solid ${t.pillBorder}`,
                      fontSize: "13px",
                    }}
                  >
                    {renderAvatar(r.guestName, null, {
                      width: "20px",
                      height: "20px",
                      fontSize: "10px",
                      minWidth: "20px",
                    })}
                    <span>{r.guestName}</span>
                  </div>
                ))}
              </div>
            </GuestRsvpGroup>
          )}
        </EventCard>
      )}
    </>
  );
}
