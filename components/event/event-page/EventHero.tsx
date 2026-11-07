"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { FileText, Pencil, Settings } from "lucide-react";
import { InlineEdit } from "./InlineEdit";
import { DateEdit } from "./DateEdit";
import { LocationEdit } from "./LocationEdit";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "./EventCard";
import { HeroScrim } from "./HeroScrim";

export function EventHero({
  event,
  setEvent,
  detailsRef,
  titleRef,
  fileInputRef,
  renderAvatar,
  isUploading,
  isPending,
  t,
  save,
  uploadStatus,
  handleCoverRemove,
  handleCoverUpload,
  isHost,
  coverUploadEnabled,
}: {
  event: EventData;
  setEvent: React.Dispatch<React.SetStateAction<EventData>>;
  detailsRef: React.RefObject<HTMLSpanElement | null>;
  titleRef: React.RefObject<HTMLSpanElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  renderAvatar: (
    name: string,
    rsvpId?: string | null,
    customStyle?: React.CSSProperties
  ) => React.ReactNode;
  isUploading: boolean;
  isPending: boolean;
  t: ResolvedTheme;
  save: (field: string, value: string) => void;
  uploadStatus: "idle" | "compressing" | "uploading";
  handleCoverRemove: () => Promise<void>;
  handleCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isHost: boolean;
  coverUploadEnabled: boolean;
}) {
  const translate = useTranslations("Ui.Event.EventHero");

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showHostsPopup, setShowHostsPopup] = useState(false);

  useEffect(() => {
    if (!showHostsPopup) return;
    const handleOutsideClick = () => {
      setShowHostsPopup(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHostsPopup(false);
    };
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showHostsPopup]);

  useEffect(() => {
    const imageUrl = event.theme?.coverImageUrl;
    if (imageUrl) {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        setAspectRatio(img.naturalWidth / img.naturalHeight);
      };
      img.onerror = () => {
        setAspectRatio(null);
      };
    } else {
      Promise.resolve().then(() => {
        setAspectRatio(null);
      });
    }
  }, [event.theme?.coverImageUrl]);

  const hasCover = !!event.theme?.coverImageUrl;
  const containerHeight = hasCover ? (aspectRatio ? "auto" : "260px") : "260px";
  const containerAspectRatio = hasCover && aspectRatio ? `${aspectRatio}` : undefined;
  const containerMinHeight = hasCover ? "200px" : "260px";
  const containerMaxHeight = hasCover ? "450px" : "260px";

  return (
    <>
      {/* Title, byline, cover and date sit on the page ground; one scrim covers them all. */}
      <HeroScrim scrim={t.heroScrim}>
        {/* ── Title ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            marginBottom: "8px",
            position: "relative",
            // Keep a long title clear of the Edit title button, and still centered.
            paddingInline: isHost ? "44px" : undefined,
          }}
        >
          <h1
            style={{
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              fontFamily: t.headingFont,
              color: t.heroText,
              textShadow: t.heroTextShadow,
              margin: 0,
              textAlign: "center",
            }}
          >
            <InlineEdit
              outerRef={titleRef}
              value={event.title}
              onSave={(v) => save("title", v)}
              placeholder={translate("eventTitle")}
              style={{
                fontSize: "36px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                fontFamily: t.headingFont,
                textAlign: "center",
              }}
              isHost={isHost}
              label={translate("eventTitle")}
              focusColor={t.accent}
            />
          </h1>
          {isHost && (
            <Button
              theme={t}
              variant="icon"
              onGround
              type="button"
              aria-label={translate("editTitle")}
              onClick={() => titleRef.current?.click()}
              style={{ position: "absolute", right: 0, top: 0 }}
            >
              <Pencil size={14} aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* ── Host byline ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "24px",
            color: t.heroTextSecondary,
            fontSize: "14px",
            textShadow: t.heroTextShadow,
          }}
        >
          {renderAvatar(event.hostDisplayName ?? event.host.name ?? event.host.email, null, {
            width: "48px",
            height: "48px",
            minWidth: "48px",
            fontSize: "18px",
          })}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px" }}>
            <span>
              {translate("organizer", {
                name: event.hostDisplayName ?? event.host.name ?? event.host.email,
              })}
            </span>
            {event.coHosts && event.coHosts.length === 1 && (
              <span>
                {" + "}
                {event.coHosts[0].displayName ||
                  event.coHosts[0].user.name ||
                  event.coHosts[0].user.email}
              </span>
            )}
            {event.coHosts && event.coHosts.length > 1 && (
              <span style={{ position: "relative" }}>
                {" + "}
                <Button
                  theme={t}
                  variant="link"
                  onGround
                  type="button"
                  aria-expanded={showHostsPopup}
                  aria-controls="event-cohosts-list"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHostsPopup(!showHostsPopup);
                  }}
                >
                  {event.coHosts.length} {translate("others")}
                </Button>
                {showHostsPopup && (
                  <div
                    id="event-cohosts-list"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginTop: "8px",
                      backgroundColor: "rgba(20, 20, 25, 0.95)",
                      backdropFilter: "blur(14px)",
                      WebkitBackdropFilter: "blur(14px)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "12px",
                      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                      zIndex: 50,
                      width: "max-content",
                      minWidth: "160px",
                      maxWidth: "240px",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "rgba(255, 255, 255, 0.4)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        paddingBottom: "4px",
                        marginBottom: "2px",
                      }}
                    >
                      {translate("coHosts")}
                    </div>
                    {event.coHosts.map((ch) => {
                      const name = ch.displayName || ch.user.name || ch.user.email;
                      return (
                        <div
                          key={ch.id}
                          style={{
                            fontSize: "13px",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              backgroundColor: t.accent,
                              color: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {name[0].toUpperCase()}
                          </div>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </span>
            )}
            {isHost && (
              <a
                href={`/e/${event.slug}/settings?section=hosts`}
                style={{
                  marginLeft: "4px",
                  color: t.heroTextMuted,
                  display: "inline-flex",
                  alignItems: "center",
                }}
                title={translate("hostSettings")}
              >
                <Settings size={13} />
              </a>
            )}
          </div>
        </div>

        {/* ── Cover image ── */}
        {(event.theme?.coverImageUrl || isHost) && (
          <div
            style={{
              background: event.theme?.coverImageUrl
                ? "transparent"
                : `linear-gradient(135deg, ${t.accent} 0%, #ec4899 100%)`,
              width: "100%",
              height: containerHeight,
              aspectRatio: containerAspectRatio,
              minHeight: containerMinHeight,
              maxHeight: containerMaxHeight,
              borderRadius: "20px",
              marginBottom: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              boxShadow:
                t.pageDecoration === "dark-orbs"
                  ? `0 0 60px ${t.accentBg}`
                  : t.pageDecoration === "soft-blobs"
                    ? "0 20px 60px rgba(0,0,0,0.08)"
                    : "none",
            }}
          >
            {event.theme?.coverImageUrl && (
              <NextImage
                src={event.theme.coverImageUrl}
                alt={translate("coverAlt", { title: event.title })}
                fill
                priority
                sizes="(max-width: 600px) calc(100vw - 32px), 568px"
                style={{ objectFit: "cover" }}
              />
            )}
            {!event.theme?.coverImageUrl && <span style={{ fontSize: "72px" }}>🎉</span>}
            {isHost && coverUploadEnabled && (
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  display: "flex",
                  gap: "6px",
                  zIndex: 1,
                }}
              >
                <Button
                  theme={t}
                  variant="overlay"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {uploadStatus === "compressing"
                    ? translate("compressing")
                    : uploadStatus === "uploading"
                      ? translate("uploading")
                      : translate("cover")}
                </Button>
                {event.theme?.coverImageUrl && (
                  <Button
                    theme={t}
                    variant="overlay"
                    size="sm"
                    onClick={handleCoverRemove}
                    disabled={isPending}
                  >
                    {translate("remove")}
                  </Button>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleCoverUpload}
            />
          </div>
        )}

        {/* ── Date badges (inline editable for host) ── */}
        <DateEdit
          startAt={event.startAt}
          endAt={event.endAt}
          timezone={event.timezone}
          eventId={event.id}
          isHost={isHost}
          theme={t}
          onSave={(start, end) => setEvent((e) => ({ ...e, startAt: start, endAt: end }))}
          eventTitle={event.title}
          eventDescription={event.description}
          locationName={event.locationName}
          virtualUrl={event.virtualUrl}
        />
      </HeroScrim>

      {/* ── Location ── */}
      <LocationEdit
        eventId={event.id}
        locationType={event.locationType}
        locationName={event.locationName}
        locationAddress={event.locationAddress}
        virtualUrl={event.virtualUrl}
        isHost={isHost}
        theme={t}
        onSave={(data) => setEvent((e) => ({ ...e, ...data }))}
      />

      {/* ── Description ── */}
      <EventCard theme={t} aria-labelledby="event-description-heading">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FileText size={16} style={{ color: t.accent }} />
            <h2
              id="event-description-heading"
              style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}
            >
              {translate("description")}
            </h2>
          </div>
          {isHost && (
            <Button
              theme={t}
              variant="icon"
              type="button"
              aria-label={translate("editDescription")}
              onClick={() => detailsRef.current?.click()}
            >
              <Pencil size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
        <InlineEdit
          outerRef={detailsRef}
          value={event.description ?? ""}
          onSave={(v) => save("description", v)}
          placeholder={translate("addDescription")}
          label={translate("description")}
          focusColor={t.accent}
          multiline
          style={{
            color: t.textSecondary,
            lineHeight: "1.7",
            fontSize: "16px",
            whiteSpace: "pre-wrap",
            display: "block",
          }}
          isHost={isHost}
        />
      </EventCard>
    </>
  );
}
