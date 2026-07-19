"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CircleCheck, CircleHelp, CircleX, Clock3 } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { RSVP_RESPONSE_STATUSES, RsvpStatusChoice } from "@/components/rsvp/status";

const FLOATING_BOTTOM_GAP = 12;

type SubmittedStatus = "GOING" | "MAYBE" | "NO";

const RESPONSE_SUMMARIES: Record<
  SubmittedStatus,
  { label: string; icon: typeof CircleCheck; color: string }
> = {
  GOING: { label: "You’re going", icon: CircleCheck, color: "#22c55e" },
  MAYBE: { label: "Marked as maybe", icon: CircleHelp, color: "#f59e0b" },
  NO: { label: "Can’t make it", icon: CircleX, color: "#ef4444" },
};

export function RsvpSection({
  event,
  t,
  isHost,
  guestEditToken,
  rsvpStatus,
  rsvpDone,
  rsvpApproved,
}: {
  event: EventData;
  t: ResolvedTheme;
  isHost: boolean;
  guestEditToken: string | null;
  rsvpStatus: "GOING" | "MAYBE" | "NO" | "INVITED" | null;
  rsvpDone: boolean;
  rsvpApproved: boolean;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [dockedHeight, setDockedHeight] = useState(0);

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

  const unansweredWindowOpen = !eventStarted && !deadlinePassed;
  const responseWindowOpen = !eventStarted && (!deadlinePassed || event.allowEditAfterDeadline);
  const shouldFloat =
    !isHost && ((!rsvpDone && unansweredWindowOpen) || (rsvpDone && responseWindowOpen));
  const canEdit = rsvpDone && !!guestEditToken && responseWindowOpen;

  useEffect(() => {
    if (!shouldFloat) return;

    const updatePosition = () => {
      const slot = slotRef.current;
      const card = cardRef.current;
      if (!slot || !card) return;

      const measuredHeight = card.offsetHeight || card.getBoundingClientRect().height;
      if (measuredHeight > 0) {
        setCardHeight(measuredHeight);
        if (!isFloating) setDockedHeight(measuredHeight);
      }

      const slotRect = slot.getBoundingClientRect();
      const dockingLine = window.innerHeight - FLOATING_BOTTOM_GAP - measuredHeight;
      const slotIsDocked = slotRect.top <= dockingLine && slotRect.bottom > 0;
      setIsFloating(!slotIsDocked);
    };

    const onScroll = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updatePosition);

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    if (cardRef.current) resizeObserver?.observe(cardRef.current);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updatePosition);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      resizeObserver?.disconnect();
    };
  }, [shouldFloat, isFloating]);

  if (isHost) return null;

  const submittedStatus = rsvpDone && rsvpStatus && rsvpStatus !== "INVITED" ? rsvpStatus : null;
  const summary = submittedStatus ? RESPONSE_SUMMARIES[submittedStatus] : null;
  const SummaryIcon = !rsvpApproved ? Clock3 : summary?.icon;
  const summaryColor = !rsvpApproved ? "#f59e0b" : summary?.color;
  const floating = shouldFloat && isFloating;
  const reservedHeight = Math.max(cardHeight, dockedHeight);

  return (
    <div
      ref={slotRef}
      data-rsvp-slot
      style={{
        display: "flow-root",
        minHeight:
          floating && reservedHeight > 0 ? `${reservedHeight + (rsvpDone ? 0 : 16)}px` : undefined,
      }}
    >
      <div
        ref={cardRef}
        data-rsvp-floating={floating ? "true" : "false"}
        style={
          floating
            ? {
                position: "fixed",
                zIndex: 60,
                left: "50%",
                bottom: "calc(12px + env(safe-area-inset-bottom))",
                transform: "translateX(-50%)",
                width: "calc(100vw - 32px)",
                maxWidth: "408px",
              }
            : undefined
        }
      >
        <EventCard
          theme={t}
          aria-labelledby="event-rsvp-heading"
          style={{
            padding: rsvpDone ? "14px 16px" : floating ? "12px 14px" : "24px",
            marginBottom: floating ? 0 : "16px",
          }}
        >
          {summary && SummaryIcon ? (
            <div
              id="event-rsvp-heading"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                <SummaryIcon
                  data-rsvp-status-icon={rsvpApproved ? submittedStatus : "PENDING"}
                  size={19}
                  style={{ color: summaryColor, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    role="heading"
                    aria-level={2}
                    style={{ fontWeight: 700, fontSize: "14px", lineHeight: 1.25 }}
                  >
                    {rsvpApproved ? summary.label : "RSVP received"}
                  </div>
                  {!rsvpApproved && (
                    <div style={{ color: t.textMuted, fontSize: "11px", marginTop: "2px" }}>
                      Awaiting host approval
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <a
                  href={`/e/${event.slug}/rsvp?token=${guestEditToken}`}
                  style={{
                    color: t.accent,
                    flexShrink: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Edit my RSVP
                </a>
              )}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginBottom: event.rsvpDeadline ? "6px" : floating ? "8px" : "16px",
                }}
              >
                <CalendarCheck size={16} style={{ color: t.accent, flexShrink: 0 }} />
                <h2
                  id="event-rsvp-heading"
                  style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}
                >
                  Are you going?
                </h2>
              </div>
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

              {(eventStarted || deadlinePassed) && !rsvpDone ? (
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
              ) : (
                <div style={{ display: "flex", gap: floating ? "6px" : "10px" }}>
                  {RSVP_RESPONSE_STATUSES.filter(
                    (status) => status !== "MAYBE" || event.maybeEnabled
                  ).map((status) => (
                    <RsvpStatusChoice
                      key={status}
                      status={status}
                      theme={t}
                      compact={floating}
                      href={`/e/${event.slug}/rsvp?status=${status}${guestEditToken ? `&token=${guestEditToken}` : ""}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </EventCard>
      </div>
    </div>
  );
}
