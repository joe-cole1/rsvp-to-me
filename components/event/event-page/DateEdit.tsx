"use client";

import { useTranslations, useLocale } from "next-intl";

import { X, Pencil, CalendarPlus } from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
import { saveEventDates } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import { formatDate, formatTime, toDateTimeLocal, tzLocalToUtcClient } from "./helpers";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

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
  const translate = useTranslations("Ui.Event.DateEdit");
  const common = useTranslations("Ui.Common");
  const locale = useLocale();
  const onGradient = t.pageDecoration === "bold-hero";

  const [open, setOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { runWithCaptcha } = useCaptcha();

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
      await runWithCaptcha("event_edit", (token) =>
        saveEventDates(eventId, startVal, endVal || null, token)
      );
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
            title={isHost ? translate("clickEditDateTime") : undefined}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: t.heroText,
                textShadow: t.heroTextShadow,
              }}
            >
              {formatDate(startAt, timezone, locale)}
            </div>
            <div
              style={{
                fontSize: "16px",
                color: t.heroTextSecondary,
                marginTop: "4px",
                fontWeight: 500,
                textShadow: t.heroTextShadow,
              }}
            >
              {formatTime(startAt, timezone, locale)}
              {endAt ? ` – ${formatTime(endAt, timezone, locale)}` : ""}
            </div>
          </div>
          {isHost && (
            <Button
              theme={t}
              variant="icon"
              onGround
              type="button"
              aria-label={translate("editDateTime")}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                openPopover();
              }}
            >
              <Pencil size={14} aria-hidden="true" />
            </Button>
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
              <Label theme={t}>{translate("startDateTime")}</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Input
                  theme={t}
                  type="date"
                  aria-label={translate("startDateTime")}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  theme={t}
                  type="time"
                  aria-label={translate("startDateTime")}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <Label theme={t}>
                {translate("endDateTime")}{" "}
                <span style={{ fontWeight: 400 }}>{translate("optional")}</span>
              </Label>
              <div style={{ display: "flex", gap: "6px" }}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", flex: 1 }}
                >
                  <Input
                    theme={t}
                    type="date"
                    aria-label={translate("endDateTime")}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <Input
                    theme={t}
                    type="time"
                    aria-label={translate("endDateTime")}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                {(endDate || endTime) && (
                  <Button
                    theme={t}
                    variant="icon"
                    onClick={() => {
                      setEndDate("");
                      setEndTime("");
                    }}
                    aria-label={`${common("remove")}: ${translate("endDateTime")}`}
                  >
                    <X size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            <p style={{ fontSize: "12px", color: t.textMuted, marginBottom: "14px" }}>
              {timezone.replace(/_/g, " ")}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                theme={t}
                variant="primary"
                onClick={save}
                disabled={!startDate || !startTime || isPending}
                style={{ flex: 1 }}
              >
                {isPending ? translate("saving") : translate("save")}
              </Button>
              <Button theme={t} variant="secondary" onClick={() => setOpen(false)}>
                {translate("cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar icon button */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setCalOpen(!calOpen)}
          style={{
            // On the BOLD gradient the button is white glass.
            background: onGradient ? "rgba(255,255,255,0.2)" : t.cardBg,
            border: `1px solid ${onGradient ? "rgba(255,255,255,0.3)" : t.cardBorder}`,
            borderRadius: "12px",
            color: onGradient ? t.heroText : t.textSecondary,
            backdropFilter: onGradient ? "blur(8px)" : undefined,
            WebkitBackdropFilter: onGradient ? "blur(8px)" : undefined,
            cursor: "pointer",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            transition: "all 0.2s ease",
          }}
          title={translate("addCalendar")}
          aria-label={translate("addCalendar")}
          aria-expanded={calOpen}
          className="rsvp-control"
        >
          <CalendarPlus size={22} aria-hidden="true" />
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
              {translate("googleCalendar")}
            </CalendarMenuItem>
            <CalendarMenuItem
              href={icalDataUri}
              download={`${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`}
              onClick={() => setCalOpen(false)}
              theme={t}
            >
              {translate("icalOutlookIcs")}
            </CalendarMenuItem>
          </div>
        )}
      </div>
    </div>
  );
}
