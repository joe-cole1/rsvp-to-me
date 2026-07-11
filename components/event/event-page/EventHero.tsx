"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil, Settings } from "lucide-react";
import { InlineEdit } from "./InlineEdit";
import { DateEdit } from "./DateEdit";
import { LocationEdit } from "./LocationEdit";
import type { EventData } from "./types";
import type { ResolvedTheme } from "@/lib/theme";
import type { EventPageStyles } from "./styles";

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
  S,
  coverStyle,
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
  S: EventPageStyles;
  coverStyle: React.CSSProperties;
  isHost: boolean;
  coverUploadEnabled: boolean;
}) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showHostsPopup, setShowHostsPopup] = useState(false);

  useEffect(() => {
    if (!showHostsPopup) return;
    const handleOutsideClick = () => {
      setShowHostsPopup(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
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
      {/* ── Title ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          marginBottom: "8px",
          position: "relative",
        }}
      >
        <h1
          style={{
            fontSize: "36px",
            fontWeight: 900,
            letterSpacing: "-0.02em",
            fontFamily: t.headingFont,
            color: t.heroText ?? t.textPrimary,
            textShadow: t.heroTextShadow,
            margin: 0,
            textAlign: "center",
          }}
        >
          <InlineEdit
            outerRef={titleRef}
            value={event.title}
            onSave={(v) => save("title", v)}
            placeholder="Event title"
            style={{
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              fontFamily: t.headingFont,
              textAlign: "center",
            }}
            isHost={isHost}
          />
        </h1>
        {isHost && (
          <Pencil
            size={12}
            style={{
              color: t.heroText ? "rgba(255,255,255,0.45)" : t.textMuted,
              cursor: "pointer",
              marginTop: "10px",
              flexShrink: 0,
              position: "absolute",
              right: 0,
            }}
            onClick={() => titleRef.current?.click()}
          />
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
          color: t.heroText ? "rgba(255,255,255,0.85)" : t.textSecondary,
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
          <span>Hosted by {event.hostDisplayName ?? event.host.name ?? event.host.email}</span>
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
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHostsPopup(!showHostsPopup);
                }}
                style={{
                  cursor: "pointer",
                  textDecoration: "underline dotted",
                  fontWeight: 600,
                  color: t.heroText ? "#ffffff" : t.textPrimary,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {event.coHosts.length} others
              </span>
              {showHostsPopup && (
                <div
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
                    Co-Hosts
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
                color: t.heroText ? "rgba(255,255,255,0.5)" : t.textMuted,
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Host settings"
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
            ...coverStyle,
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
          {!event.theme?.coverImageUrl && <span style={{ fontSize: "72px" }}>🎉</span>}
          {isHost && coverUploadEnabled && (
            <div
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                display: "flex",
                gap: "6px",
              }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(8px)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  opacity: isUploading ? 0.7 : 1,
                }}
              >
                {uploadStatus === "compressing"
                  ? "Compressing…"
                  : uploadStatus === "uploading"
                    ? "Uploading…"
                    : "📷 Cover"}
              </button>
              {event.theme?.coverImageUrl && (
                <button
                  onClick={handleCoverRemove}
                  disabled={isPending}
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(8px)",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 10px",
                    cursor: isPending ? "not-allowed" : "pointer",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    opacity: isPending ? 0.7 : 1,
                  }}
                >
                  🗑 Remove
                </button>
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
      <div style={{ ...S.card, marginBottom: "16px" }}>
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
            <span style={{ fontWeight: 700, fontFamily: t.headingFont }}>Description</span>
          </div>
          {isHost && (
            <Pencil
              size={12}
              style={{ color: t.textMuted, cursor: "pointer" }}
              onClick={() => detailsRef.current?.click()}
            />
          )}
        </div>
        <InlineEdit
          outerRef={detailsRef}
          value={event.description ?? ""}
          onSave={(v) => save("description", v)}
          placeholder="Add a description…"
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
      </div>
    </>
  );
}
