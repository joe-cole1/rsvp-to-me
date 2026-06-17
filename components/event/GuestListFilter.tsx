"use client";

import { useState } from "react";
import type { ResolvedTheme } from "@/lib/theme";

type RSVPAnswer = { label: string; value: string };

type RSVP = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
  note: string | null;
  createdAt: string;
  answers: RSVPAnswer[];
  plusOneGuests: string[];
};

type InvitedGuest = {
  id: string;
  sentTo: string;
  channel: "EMAIL" | "SMS";
  sentAt: string;
};

type Filter = "ALL" | "GOING" | "MAYBE" | "NO" | "INVITED";

export function GuestListFilter({
  going,
  maybe,
  no,
  invited,
  isHost,
  t,
}: {
  going: RSVP[];
  maybe: RSVP[];
  no: RSVP[];
  invited: InvitedGuest[];
  isHost: boolean;
  t: ResolvedTheme;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const statusLabel = (s: string) =>
    s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't make it";
  const statusColor = (s: string) =>
    s === "GOING" ? t.accent : s === "MAYBE" ? t.textSecondary : t.textMuted;

  const allRsvps = [...going, ...maybe, ...no];
  const displayedRsvps =
    filter === "ALL"    ? allRsvps :
    filter === "GOING"  ? going :
    filter === "MAYBE"  ? maybe :
    filter === "NO"     ? no :
    [];

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "ALL",     label: "All",           count: allRsvps.length + (isHost ? invited.length : 0) },
    { key: "GOING",   label: "Going",         count: going.length },
    { key: "MAYBE",   label: "Maybe",         count: maybe.length },
    { key: "NO",      label: "Can't make it", count: no.length },
    ...(isHost ? [{ key: "INVITED" as Filter, label: "Invited", count: invited.length }] : []),
  ];

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    border: active ? "none" : `1px solid ${t.cardBorder}`,
    background: active ? t.accent : t.cardBg,
    color: active ? t.accentFg : t.textSecondary,
    whiteSpace: "nowrap",
    fontFamily: "inherit",
    flexShrink: 0,
  });

  const cardStyle: React.CSSProperties = {
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: "14px",
    padding: "14px 18px",
    marginBottom: "8px",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
  };

  return (
    <>
      <div style={{
        display: "flex", gap: "8px", overflowX: "auto",
        paddingBottom: "4px", marginBottom: "20px",
      }}>
        {chips.map(({ key, label, count }) => (
          <button key={key} onClick={() => setFilter(key)} style={chipStyle(filter === key)}>
            {label}
            {count > 0 && (
              <span style={{ marginLeft: "5px", opacity: 0.75 }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {displayedRsvps.length === 0 && filter !== "INVITED" ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
          No one here yet.
        </div>
      ) : (
        <>
          {displayedRsvps.map((r) => (
            <div key={r.id} style={cardStyle}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: t.avatarGradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: "15px", flexShrink: 0, color: t.accentFg,
                opacity: r.status === "NO" ? 0.4 : r.status === "MAYBE" ? 0.7 : 1,
              }}>
                {r.guestName[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "15px" }}>{r.guestName}</span>
                  {r.plusOneCount > 0 && (
                    <span style={{ fontSize: "12px", color: t.textMuted }}>+{r.plusOneCount}</span>
                  )}
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                    background: t.pillBg, color: statusColor(r.status),
                  }}>
                    {statusLabel(r.status)}
                  </span>
                </div>
                {r.note && (
                  <p style={{ color: t.textMuted, fontSize: "13px", margin: "4px 0 0", lineHeight: 1.5 }}>
                    {r.note}
                  </p>
                )}
                {isHost && (r.guestEmail || r.guestPhone) && (
                  <div style={{ marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {r.guestEmail && <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestEmail}</span>}
                    {r.guestPhone && <span style={{ color: t.textMuted, fontSize: "12px" }}>{r.guestPhone}</span>}
                  </div>
                )}
                {isHost && r.plusOneGuests.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {r.plusOneGuests.map((name) => (
                      <span key={name} style={{ fontSize: "11px", background: t.pillBg, border: `1px solid ${t.cardBorder}`, borderRadius: "99px", padding: "2px 8px", color: t.textSecondary }}>
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                {isHost && r.answers.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {r.answers.map((a) => (
                      <div key={a.label} style={{ fontSize: "12px" }}>
                        <span style={{ color: t.textMuted }}>{a.label}: </span>
                        <span style={{ color: t.textSecondary }}>{a.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ color: t.textMuted, fontSize: "11px", marginTop: "4px" }}>
                  {new Date(r.createdAt).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {filter === "INVITED" && invited.map((inv) => (
            <div key={inv.id} style={{ ...cardStyle, alignItems: "center", opacity: 0.75 }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "50%",
                background: t.pillBg, border: `1px solid ${t.cardBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: t.textMuted, fontSize: "16px",
              }}>
                ✉
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: "14px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {inv.sentTo}
                </div>
                <div style={{ color: t.textMuted, fontSize: "12px", marginTop: "2px" }}>
                  Invited via {inv.channel === "EMAIL" ? "email" : "SMS"} ·{" "}
                  {new Date(inv.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px",
                background: t.pillBg, color: t.textMuted, whiteSpace: "nowrap", flexShrink: 0,
              }}>
                No reply
              </span>
            </div>
          ))}

          {filter === "INVITED" && invited.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: t.textMuted }}>
              No pending invites.
            </div>
          )}
        </>
      )}
    </>
  );
}
