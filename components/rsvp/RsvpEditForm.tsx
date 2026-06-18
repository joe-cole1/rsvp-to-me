"use client";

import { useState, useTransition } from "react";
import { updateRSVP } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";

type RsvpData = {
  editToken: string;
  guestName: string;
  status: "GOING" | "MAYBE" | "NO";
  plusOneCount: number;
};

type EventData = {
  title: string;
  slug: string;
  startAt: Date;
  locationName: string | null;
  plusOneAllowed: boolean;
  plusOneMax: number;
};

export function RsvpEditForm({
  rsvp,
  event,
  theme,
}: {
  rsvp: RsvpData;
  event: EventData;
  theme: ResolvedTheme;
}) {
  const [status, setStatus] = useState(rsvp.status);
  const [plusOne, setPlusOne] = useState(rsvp.plusOneCount);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const t = theme;

  const dateStr = new Date(event.startAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const save = () => {
    startTransition(async () => {
      const result = await updateRSVP(rsvp.editToken, { status, plusOneCount: plusOne });
      if (result.success) setDone(true);
    });
  };

  const S = {
    page: {
      minHeight: "100vh",
      background: t.pageBg,
      color: t.textPrimary,
      fontFamily: "inherit",
      display: "flex" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: "24px",
    },
    card: {
      background: t.cardBg,
      border: `1px solid ${t.cardBorder}`,
      borderRadius: t.cardRadius,
      padding: "28px 24px",
      width: "100%",
      maxWidth: "400px",
    },
    btn: {
      background: t.accent,
      color: t.accentFg,
      fontFamily: "inherit",
      fontSize: "14px",
      fontWeight: t.btnFontWeight as React.CSSProperties["fontWeight"],
      padding: "14px",
      border: "none",
      borderRadius: t.btnRadius,
      cursor: "pointer" as const,
      width: "100%",
      boxShadow: t.accentShadow,
    },
  };

  if (done) {
    return (
      <div style={S.page}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>
            {status === "GOING" ? "🎉" : status === "MAYBE" ? "🤔" : "😔"}
          </div>
          <h2 style={{ marginBottom: "8px", fontWeight: 700 }}>RSVP updated!</h2>
          <p style={{ color: t.textSecondary, marginBottom: "24px", fontSize: "14px" }}>
            {status === "GOING"
              ? "See you there!"
              : status === "MAYBE"
              ? "We hope you can make it."
              : "Sorry you can't make it."}
          </p>
          <a
            href={`/e/${event.slug}?token=${rsvp.editToken}`}
            style={{ ...S.btn, display: "block", textDecoration: "none", textAlign: "center" as const }}
          >
            View Event
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <p style={{ color: t.textMuted, fontSize: "13px", marginBottom: "4px" }}>Update your RSVP</p>
        <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>{event.title}</h1>
        <p style={{ color: t.textSecondary, fontSize: "14px", marginBottom: "24px" }}>
          {dateStr}
          {event.locationName ? ` · ${event.locationName}` : ""}
        </p>

        <p style={{ fontSize: "13px", fontWeight: 600, color: t.textMuted, marginBottom: "10px" }}>
          Hey {rsvp.guestName}, are you coming?
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {(["GOING", "MAYBE", "NO"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                flex: 1,
                padding: "12px 8px",
                border: status === s ? "none" : `1px solid ${t.inputBorder}`,
                borderRadius: t.btnRadius,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
                fontWeight: 600,
                background: status === s ? t.accent : t.inputBg,
                color: status === s ? t.accentFg : t.textSecondary,
                boxShadow: status === s ? t.accentShadow : "none",
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "4px" }}>
                {s === "GOING" ? "🎉" : s === "MAYBE" ? "🤔" : "😔"}
              </div>
              {s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't go"}
            </button>
          ))}
        </div>

        {event.plusOneAllowed && event.plusOneMax > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Plus ones</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {Array.from({ length: event.plusOneMax + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPlusOne(i)}
                  style={{
                    width: "36px",
                    height: "36px",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "13px",
                    fontWeight: 700,
                    background: plusOne === i ? t.accent : t.inputBg,
                    color: plusOne === i ? t.accentFg : t.textSecondary,
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={save} disabled={isPending} style={{ ...S.btn, opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Saving…" : "Save RSVP"}
        </button>
        <p style={{ textAlign: "center", marginTop: "12px" }}>
          <a href={`/e/${event.slug}?token=${rsvp.editToken}`} style={{ color: t.textMuted, fontSize: "13px", textDecoration: "none" }}>
            Back to event →
          </a>
        </p>
      </div>
    </div>
  );
}
