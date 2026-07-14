"use client";

import { Settings, Users } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function GuestListSection({
  event,
  renderAvatar,
  t,
  S,
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
  S: EventPageStyles;
  isHost: boolean;
  going: EventData["rsvps"];
  maybe: EventData["rsvps"];
  no: EventData["rsvps"];
  totalGoing: number;
}) {
  return (
    <>
      {/* ── Guest List ── */}
      {(isHost || (event.guestListVis === "ALL" && event.rsvps.length > 0)) && (
        <div style={S.card}>
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
              <span style={{ fontWeight: 700, fontFamily: t.headingFont }}>
                Guests ({event.rsvps.length})
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <a
                href={`/e/${event.slug}/guests`}
                style={{
                  fontSize: "13px",
                  color: t.accent,
                  textDecoration: "none",
                  opacity: 0.85,
                }}
              >
                View all →
              </a>
              {isHost && (
                <a
                  href={`/e/${event.slug}/settings?section=rsvp`}
                  aria-label="RSVP settings"
                  title="RSVP settings"
                  style={{ color: t.textMuted, display: "flex", alignItems: "center" }}
                >
                  <Settings size={13} />
                </a>
              )}
            </div>
          </div>
          {going.length > 0 && (
            <div style={{ marginBottom: maybe.length > 0 || no.length > 0 ? "14px" : 0 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none" as const,
                  letterSpacing: "0.02em",
                  color: t.textMuted,
                  marginBottom: "8px",
                }}
              >
                Going · {totalGoing}
              </div>
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
            </div>
          )}
          {maybe.length > 0 && (
            <div style={{ marginBottom: no.length > 0 ? "14px" : 0 }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none" as const,
                  letterSpacing: "0.02em",
                  color: t.textMuted,
                  marginBottom: "8px",
                }}
              >
                Maybe · {maybe.length}
              </div>
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
            </div>
          )}
          {no.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none" as const,
                  letterSpacing: "0.02em",
                  color: t.textMuted,
                  marginBottom: "8px",
                }}
              >
                Can&apos;t make it · {no.length}
              </div>
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
            </div>
          )}
        </div>
      )}
    </>
  );
}
