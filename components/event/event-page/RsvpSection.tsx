"use client";

import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function RsvpSection({
  event,
  t,
  S,
  isHost,
  guestEditToken,
  rsvpStatus,
  rsvpDone,
}: {
  event: EventData;
  t: ResolvedTheme;
  S: EventPageStyles;
  isHost: boolean;
  guestEditToken: string | null;
  rsvpStatus: "GOING" | "MAYBE" | "NO" | "INVITED" | null;
  rsvpDone: boolean;
}) {
  return (
    <>
      {/* ── RSVP Section ── */}
      {!isHost && (
        <div style={S.card}>
          <h2
            style={{
              fontSize: "17px",
              fontWeight: 700,
              marginBottom: event.rsvpDeadline ? "6px" : "16px",
              fontFamily: t.headingFont,
            }}
          >
            Are you coming?
          </h2>
          {event.rsvpDeadline &&
            (() => {
              const deadline = new Date(event.rsvpDeadline);
              const now = new Date();
              const diffMs = deadline.getTime() - now.getTime();
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              const dateStr = deadline.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              });
              const countdownStr =
                diffDays > 1
                  ? `${diffDays} days remaining`
                  : diffDays === 1
                    ? "1 day remaining"
                    : diffDays === 0
                      ? "today"
                      : "deadline passed";
              return (
                <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "16px" }}>
                  RSVPs requested no later than {dateStr} · {countdownStr}
                </div>
              );
            })()}

          {rsvpDone ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>
                {rsvpStatus === "GOING" ? "🎉" : rsvpStatus === "MAYBE" ? "🤔" : "😔"}
              </div>
              <div style={{ fontWeight: 700, marginBottom: "12px" }}>
                {rsvpStatus === "GOING"
                  ? "You're going!"
                  : rsvpStatus === "MAYBE"
                    ? "Marked as maybe"
                    : "Can't make it"}
              </div>
              {guestEditToken && (
                <a
                  href={`/e/${event.slug}/rsvp?token=${guestEditToken}`}
                  style={{
                    fontSize: "13px",
                    color: t.accent,
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Edit my RSVP →
                </a>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              {(["GOING", "MAYBE", "NO"] as const)
                .filter((s) => s !== "MAYBE" || event.maybeEnabled)
                .map((s) => (
                  <a
                    key={s}
                    href={`/e/${event.slug}/rsvp?status=${s}${guestEditToken ? `&token=${guestEditToken}` : ""}`}
                    style={{
                      flex: 1,
                      padding: "14px 8px",
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: t.btnRadius,
                      fontFamily: "inherit",
                      fontSize: "12px",
                      fontWeight: 700,
                      background: t.inputBg,
                      color: t.textSecondary,
                      textDecoration: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>
                      {s === "GOING" ? "🎉" : s === "MAYBE" ? "🤔" : "😔"}
                    </span>
                    {s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't go"}
                  </a>
                ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
