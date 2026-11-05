"use client";

import { useTranslations, useLocale } from "next-intl";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CircleCheck, CircleHelp, CircleX, Clock3 } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { RSVP_RESPONSE_STATUSES, RsvpStatusChoice } from "@/components/rsvp/status";

const FLOATING_BOTTOM_GAP = 12;
// A docked card must pass an edge by this much before it floats again, so jitter at
// the docking line cannot flip it back and forth.
const DOCKING_HYSTERESIS = 8;

type SubmittedStatus = "GOING" | "MAYBE" | "NO";

// Decides from the docked card's geometry only. The compact floating card is
// shorter, so a line measured from whichever card is on screen would move with
// the state and could contradict itself.
function shouldCardFloat(
  wasFloating: boolean,
  slotTop: number,
  dockedHeight: number,
  viewportHeight: number
) {
  const dockedBottom = slotTop + dockedHeight;
  const slack = wasFloating ? 0 : DOCKING_HYSTERESIS;
  return dockedBottom > viewportHeight - FLOATING_BOTTOM_GAP + slack || dockedBottom <= -slack;
}

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
  const translate = useTranslations("Ui.Event.RsvpSection");
  const locale = useLocale();

  const RESPONSE_SUMMARIES: Record<
    SubmittedStatus,
    { label: string; icon: typeof CircleCheck; color: string }
  > = {
    GOING: { label: translate("reGoing"), icon: CircleCheck, color: t.status.success.text },
    MAYBE: { label: translate("markedAsMaybe"), icon: CircleHelp, color: t.status.warning.text },
    NO: { label: translate("canTMake"), icon: CircleX, color: t.status.error.text },
  };

  const slotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isFloatingRef = useRef(false);
  const cardHeightRef = useRef(0);
  const dockedHeightRef = useRef(0);
  const [isFloating, setIsFloating] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const [dockedHeight, setDockedHeight] = useState(0);

  const now = new Date();
  const deadline = event.rsvpDeadline ? new Date(event.rsvpDeadline) : null;
  const deadlinePassed = deadline ? deadline < now : false;
  const eventStarted = new Date(event.startAt) <= now;
  const deadlineDate = deadline?.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    timeZone: event.timezone,
  });
  const deadlineDays = deadline
    ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const deadlineCountdown =
    deadlineDays === null
      ? null
      : deadlineDays > 1
        ? translate("remainingDays", { count: deadlineDays })
        : deadlineDays === 1
          ? translate("1DayRemaining")
          : deadlineDays === 0
            ? translate("today")
            : translate("deadlinePassed");

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
        if (measuredHeight !== cardHeightRef.current) {
          cardHeightRef.current = measuredHeight;
          setCardHeight(measuredHeight);
        }
        // Only a measurement of the card as rendered docked may define the docking line.
        const showingDocked = card.getAttribute("data-rsvp-floating") !== "true";
        if (showingDocked && measuredHeight !== dockedHeightRef.current) {
          dockedHeightRef.current = measuredHeight;
          setDockedHeight(measuredHeight);
        }
      }

      const nextFloating = shouldCardFloat(
        isFloatingRef.current,
        slot.getBoundingClientRect().top,
        dockedHeightRef.current || measuredHeight,
        window.innerHeight
      );
      if (nextFloating !== isFloatingRef.current) {
        isFloatingRef.current = nextFloating;
        setIsFloating(nextFloating);
      }
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
  }, [shouldFloat]);

  if (isHost) return null;

  const submittedStatus = rsvpDone && rsvpStatus && rsvpStatus !== "INVITED" ? rsvpStatus : null;
  const summary = submittedStatus ? RESPONSE_SUMMARIES[submittedStatus] : null;
  const SummaryIcon = !rsvpApproved ? Clock3 : summary?.icon;
  const summaryColor = !rsvpApproved ? t.status.warning.text : summary?.color;
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
                maxWidth: "568px",
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
                    {rsvpApproved ? summary.label : translate("rsvpReceived")}
                  </div>
                  {!rsvpApproved && (
                    <div style={{ color: t.textMuted, fontSize: "11px", marginTop: "2px" }}>
                      {translate("awaitingHostApproval")}
                    </div>
                  )}
                </div>
              </div>
              {canEdit && (
                <a
                  href={`/e/${event.slug}/rsvp?token=${guestEditToken}`}
                  style={{
                    color: t.accentText,
                    flexShrink: 0,
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {translate("editMyRsvp")}
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
                  {translate("going")}
                </h2>
              </div>
              {deadline && (
                <div
                  style={{
                    fontSize: "12px",
                    color: deadlinePassed ? t.status.error.text : t.textMuted,
                    marginBottom: "16px",
                    fontWeight: deadlinePassed ? 600 : 400,
                  }}
                >
                  {translate("rsvpsRequestedNoLaterThan")} {deadlineDate} · {deadlineCountdown}
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
                    {translate("rsvpsClosed")}
                  </div>
                  <div style={{ fontSize: "12px", color: t.textMuted }}>
                    {eventStarted
                      ? translate("eventHasStartedContactHostIf")
                      : translate("deadlineRsvpEventHasPassed")}
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
