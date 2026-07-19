"use client";

import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { RSVP_RESPONSE_STATUSES, RsvpStatusChoice } from "@/components/rsvp/status";

export function RsvpSection({
  event,
  t,
  isHost,
  guestEditToken,
  rsvpStatus,
  rsvpDone,
}: {
  event: EventData;
  t: ResolvedTheme;
  isHost: boolean;
  guestEditToken: string | null;
  rsvpStatus: "GOING" | "MAYBE" | "NO" | "INVITED" | null;
  rsvpDone: boolean;
}) {
  const now = new Date();
  const deadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;
  const deadlinePassed = deadline ? deadline < now : false;
  const eventStarted = new Date(event.startAt) <= now;
  const deadlineDate = deadline?.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const deadlineDays = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineCountdown =
    deadlineDays === null
      ? null
      : deadlineDays > 1
        ? `${deadlineDays} days remaining`
        : deadlineDays === 1
          ? "1 day remaining"
          : deadlineDays === 0
            ? "today"
            : "deadline passed";

  return (
    <>
      {/* ── RSVP Section ── */}
      {!isHost && (
        <EventCard theme={t} aria-labelledby="event-rsvp-heading">
          <h2
            id="event-rsvp-heading"
            style={{
              fontSize: "17px",
              fontWeight: 700,
              marginBottom: event.rsvpDeadline ? "6px" : "16px",
              fontFamily: t.headingFont,
            }}
          >
            Are you coming?
          </h2>
          {deadline && (
            <div
              style={{
                fontSize: "12px",
                color: deadlinePassed ? "#f87171" : t.textMuted,
                marginBottom: "16px",
                fontWeight: deadlinePassed ? 600 : 400,
              }}
            >
              RSVPs requested no later than {deadlineDate} · {deadlineCountdown}
            </div>
          )}

          {(() => {
            if ((eventStarted || deadlinePassed) && !rsvpDone) {
              return (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>🔒</div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: t.textPrimary,
                      fontSize: "14px",
                      marginBottom: "4px",
                    }}
                  >
                    RSVPs Closed
                  </div>
                  <div style={{ fontSize: "12px", color: t.textMuted }}>
                    {eventStarted
                      ? "This event has started. Contact the host if you need to change your RSVP."
                      : "The deadline to RSVP for this event has passed."}
                  </div>
                </div>
              );
            }

            if (rsvpDone) {
              return (
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
                  {guestEditToken &&
                    !eventStarted &&
                    (!deadlinePassed || event.allowEditAfterDeadline) && (
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
              );
            }

            return null;
          })() || (
            <div style={{ display: "flex", gap: "10px" }}>
              {RSVP_RESPONSE_STATUSES.filter((s) => s !== "MAYBE" || event.maybeEnabled).map(
                (s) => (
                  <RsvpStatusChoice
                    key={s}
                    status={s}
                    theme={t}
                    href={`/e/${event.slug}/rsvp?status=${s}${guestEditToken ? `&token=${guestEditToken}` : ""}`}
                  />
                )
              )}
            </div>
          )}
        </EventCard>
      )}
    </>
  );
}
