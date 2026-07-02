"use client";

import { X, Pencil, CalendarPlus } from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
import { saveEventDates } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import { formatDate, formatTime, toDateTimeLocal, tzLocalToUtcClient } from "./helpers";

// ── Date/time inline editor ────────────────────────────────────────────────────

const CalendarMenuItem = ({
  href,
  children,
  download,
  target,
  rel,
  onClick,
  theme: t,
}: {
  href: string;
  children: React.ReactNode;
  download?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  theme: ResolvedTheme;
}) => {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      download={download}
      target={target}
      rel={rel}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        padding: "10px 16px",
        color: t.textPrimary,
        textDecoration: "none",
        fontSize: "14px",
        fontWeight: 500,
        background: hover ? t.inputBg : "transparent",
        cursor: "pointer",
        textAlign: "left",
        borderRadius: "8px",
      }}
    >
      {children}
    </a>
  );
};

export function DateEdit({
  startAt,
  endAt,
  timezone,
  eventId,
  isHost,
  theme: t,
  onSave,
  eventTitle,
  eventDescription,
  locationName,
  virtualUrl,
}: {
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  eventId: string;
  isHost: boolean;
  theme: ResolvedTheme;
  onSave: (start: Date, end: Date | null) => void;
  eventTitle: string;
  eventDescription: string | null;
  locationName: string | null;
  virtualUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !calOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCalOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCalOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, calOpen]);

  const openPopover = () => {
    const sLocal = toDateTimeLocal(startAt, timezone);
    const [sDate, sTime] = sLocal.split("T");
    setStartDate(sDate || "");
    setStartTime(sTime || "");

    if (endAt) {
      const eLocal = toDateTimeLocal(endAt, timezone);
      const [eDate, eTime] = eLocal.split("T");
      setEndDate(eDate || "");
      setEndTime(eTime || "");
    } else {
      setEndDate("");
      setEndTime("");
    }
    setOpen(true);
  };

  const save = () => {
    if (!startDate || !startTime) return;
    const startVal = `${startDate}T${startTime}`;
    const endVal = endDate && endTime ? `${endDate}T${endTime}` : "";
    startTransition(async () => {
      await saveEventDates(eventId, startVal, endVal || null);
      onSave(
        tzLocalToUtcClient(startVal, timezone),
        endVal ? tzLocalToUtcClient(endVal, timezone) : null
      );
      setOpen(false);
    });
  };

  const formatUtcForCal = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };
  const endUtcDate = endAt ? endAt : new Date(startAt.getTime() + 60 * 60 * 1000);
  const calendarLocation = locationName || virtualUrl || "";

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${formatUtcForCal(startAt)}/${formatUtcForCal(endUtcDate)}&details=${encodeURIComponent(eventDescription || "")}&location=${encodeURIComponent(calendarLocation)}`;

  const icalContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//rsvp-to-me//Event//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "SUMMARY:" + eventTitle,
    "DTSTART:" + formatUtcForCal(startAt),
    "DTEND:" + formatUtcForCal(endUtcDate),
    "DESCRIPTION:" + (eventDescription || "").replace(/\n/g, "\\n"),
    "LOCATION:" + calendarLocation,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icalDataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icalContent);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "20px",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <div
            style={{ cursor: isHost ? "pointer" : "default" }}
            onClick={isHost ? openPopover : undefined}
            title={isHost ? "Click to edit date/time" : undefined}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: t.heroText ?? t.textPrimary,
                textShadow: t.heroTextShadow,
              }}
            >
              {formatDate(startAt, timezone)}
            </div>
            <div
              style={{
                fontSize: "16px",
                color: t.heroText ? "rgba(255,255,255,0.85)" : t.textSecondary,
                marginTop: "4px",
                fontWeight: 500,
                textShadow: t.heroTextShadow,
              }}
            >
              {formatTime(startAt, timezone)}
              {endAt ? ` – ${formatTime(endAt, timezone)}` : ""}
            </div>
          </div>
          {isHost && (
            <Pencil
              size={12}
              style={{
                color: t.heroText ? "rgba(255,255,255,0.45)" : t.textMuted,
                cursor: "pointer",
                marginTop: "6px",
                flexShrink: 0,
              }}
              onClick={openPopover}
            />
          )}
        </div>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              zIndex: 200,
              background: t.cardBg,
              backdropFilter: "blur(20px)",
              border: `1px solid ${t.cardBorder}`,
              borderRadius: "16px",
              padding: "20px",
              minWidth: "264px",
              boxShadow: t.cardShadow || "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none",
                  letterSpacing: "0.02em",
                  color: t.textMuted,
                  marginBottom: "6px",
                }}
              >
                Start Date & Time
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.textPrimary,
                    fontFamily: "inherit",
                    fontSize: "14px",
                    colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.textPrimary,
                    fontFamily: "inherit",
                    fontSize: "14px",
                    colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "none",
                  letterSpacing: "0.02em",
                  color: t.textMuted,
                  marginBottom: "6px",
                }}
              >
                End Date & Time{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", flex: 1 }}
                >
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      color: t.textPrimary,
                      fontFamily: "inherit",
                      fontSize: "14px",
                      colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      color: t.textPrimary,
                      fontFamily: "inherit",
                      fontSize: "14px",
                      colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                {(endDate || endTime) && (
                  <button
                    onClick={() => {
                      setEndDate("");
                      setEndTime("");
                    }}
                    style={{
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      borderRadius: "10px",
                      color: t.textSecondary,
                      cursor: "pointer",
                      padding: "0 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <p style={{ fontSize: "11px", color: t.textMuted, marginBottom: "14px" }}>
              {timezone.replace(/_/g, " ")}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={save}
                disabled={!startDate || !startTime || isPending}
                style={{
                  flex: 1,
                  background: t.accent,
                  color: t.accentFg,
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: !startDate || !startTime || isPending ? "not-allowed" : "pointer",
                  opacity: !startDate || !startTime || isPending ? 0.5 : 1,
                }}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: t.inputBg,
                  color: t.textSecondary,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontFamily: "inherit",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar icon button */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setCalOpen(!calOpen)}
          style={{
            background: t.heroText ? "rgba(255,255,255,0.2)" : t.cardBg,
            border: `1px solid ${t.heroText ? "rgba(255,255,255,0.3)" : t.cardBorder}`,
            borderRadius: "12px",
            color: t.heroText ?? t.textSecondary,
            backdropFilter: t.heroText ? "blur(8px)" : undefined,
            WebkitBackdropFilter: t.heroText ? "blur(8px)" : undefined,
            cursor: "pointer",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            transition: "all 0.2s ease",
          }}
          title="Add to Calendar"
        >
          <CalendarPlus size={22} />
        </button>
        {calOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 200,
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: "12px",
              padding: "6px",
              minWidth: "180px",
              boxShadow: t.cardShadow || "0 10px 30px rgba(0,0,0,0.15)",
              backdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <CalendarMenuItem
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setCalOpen(false)}
              theme={t}
            >
              Google Calendar
            </CalendarMenuItem>
            <CalendarMenuItem
              href={icalDataUri}
              download={`${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`}
              onClick={() => setCalOpen(false)}
              theme={t}
            >
              iCal / Outlook (.ics)
            </CalendarMenuItem>
          </div>
        )}
      </div>
    </div>
  );
}
