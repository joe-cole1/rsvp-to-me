"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

import { Check, Megaphone, Copy, QrCode } from "lucide-react";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";

export function GuestSharingCard({
  event,
  t,
  isHost,
  eventLinkCopied,
  setEventLinkCopied,
  setShowShareQr,
}: {
  event: EventData;
  t: ResolvedTheme;
  isHost: boolean;
  eventLinkCopied: boolean;
  setEventLinkCopied: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShareQr: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const translate = useTranslations("Ui.Event.GuestSharingCard");

  return (
    <>
      {/* ── Guest Sharing Card ── */}
      {!isHost && event.guestSharingEnabled && event.visibility !== "PRIVATE" && (
        <EventCard
          theme={t}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Megaphone size={16} style={{ color: t.accent }} />
            <span style={{ fontWeight: 700, fontSize: "14px" }}>{translate("shareEvent")}</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              theme={t}
              variant="secondary"
              onClick={() => {
                if (typeof navigator !== "undefined") {
                  navigator.clipboard.writeText(window.location.origin + `/e/${event.slug}`);
                  setEventLinkCopied(true);
                  setTimeout(() => setEventLinkCopied(false), 2000);
                }
              }}
              style={{ flex: 1 }}
            >
              {eventLinkCopied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {eventLinkCopied ? translate("copied") : translate("copyLink")}
            </Button>
            <Button
              theme={t}
              variant="secondary"
              onClick={() => setShowShareQr(true)}
              style={{ flex: 1 }}
            >
              <QrCode size={16} aria-hidden="true" /> {translate("showQrCode")}
            </Button>
          </div>
        </EventCard>
      )}
    </>
  );
}
