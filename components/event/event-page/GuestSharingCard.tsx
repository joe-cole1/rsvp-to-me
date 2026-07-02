"use client";

import { Check } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

export function GuestSharingCard({
  event,
  t,
  S,
  isHost,
  eventLinkCopied,
  setEventLinkCopied,
  setShowShareQr,
}: {
  event: EventData;
  t: ResolvedTheme;
  S: EventPageStyles;
  isHost: boolean;
  eventLinkCopied: boolean;
  setEventLinkCopied: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShareQr: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <>
      {/* ── Guest Sharing Card ── */}
      {!isHost && event.guestSharingEnabled && event.visibility !== "PRIVATE" && (
        <div
          style={{
            ...S.card,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>📢</span>
            <span style={{ fontWeight: 700, fontSize: "14px" }}>Share this event</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                if (typeof navigator !== "undefined") {
                  navigator.clipboard.writeText(window.location.origin + `/e/${event.slug}`);
                  setEventLinkCopied(true);
                  setTimeout(() => setEventLinkCopied(false), 2000);
                }
              }}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: eventLinkCopied ? "#22c55e" : t.inputBg,
                border: `1px solid ${eventLinkCopied ? "#22c55e" : t.inputBorder}`,
                borderRadius: t.btnRadius,
                color: eventLinkCopied ? "#ffffff" : t.textPrimary,
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.15s ease-in-out",
              }}
            >
              {eventLinkCopied ? <Check size={14} /> : <span>📋</span>}
              {eventLinkCopied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={() => setShowShareQr(true)}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: t.btnRadius,
                color: t.textPrimary,
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>📱</span> Show QR Code
            </button>
          </div>
        </div>
      )}
    </>
  );
}
