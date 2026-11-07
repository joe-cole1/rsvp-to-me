"use client";

import { useTranslations } from "next-intl";

import { Plus, MapPin, Video, Check, ExternalLink, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
import { saveEventLocation } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import type { LocationType } from "./types";
import { buildMapUrl } from "./helpers";
import { LocationFields } from "@/components/event/LocationFields";
import { useCaptcha } from "@/components/ui/CaptchaProvider";
import { Button } from "@/components/ui/Button";

// ── Location inline editor ────────────────────────────────────────────────────

export function LocationEdit({
  eventId,
  locationType: initialType,
  locationName: initialName,
  locationAddress: initialAddress,
  virtualUrl: initialVirtualUrl,
  isHost,
  theme: t,
  onSave,
}: {
  eventId: string;
  locationType: LocationType;
  locationName: string | null;
  locationAddress: string | null;
  virtualUrl: string | null;
  isHost: boolean;
  theme: ResolvedTheme;
  onSave: (data: {
    locationType: LocationType;
    locationName: string | null;
    locationAddress: string | null;
    virtualUrl: string | null;
  }) => void;
}) {
  const translate = useTranslations("Ui.Event.LocationEdit");

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [type, setType] = useState<LocationType>(initialType);
  const [name, setName] = useState(initialName ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [vUrl, setVUrl] = useState(initialVirtualUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { runWithCaptcha } = useCaptcha();

  useEffect(() => {
    if (!open && !menuOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuOpen]);

  const openPopover = () => {
    setType(initialType);
    setName(initialName ?? "");
    setAddress(initialAddress ?? "");
    setVUrl(initialVirtualUrl ?? "");
    setOpen(true);
  };

  const save = () => {
    startTransition(async () => {
      await runWithCaptcha("event_edit", (token) =>
        saveEventLocation(
          eventId,
          {
            locationType: type,
            locationName: type === "PHYSICAL" ? name || null : null,
            locationAddress: type === "PHYSICAL" ? address || null : null,
            virtualUrl: type === "VIRTUAL" ? vUrl || null : null,
          },
          token
        )
      );
      onSave({
        locationType: type,
        locationName: type === "PHYSICAL" ? name || null : null,
        locationAddress: type === "PHYSICAL" ? address || null : null,
        virtualUrl: type === "VIRTUAL" ? vUrl || null : null,
      });
      setOpen(false);
    });
  };

  const cardStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    borderRadius: t.cardRadius,
    background: t.cardBg,
    border: `1px solid ${t.cardBorder}`,
    backdropFilter: "blur(12px)",
    marginBottom: "24px",
    textDecoration: "none",
    color: "inherit",
  };

  const editCardStyle: React.CSSProperties = isHost
    ? { ...cardStyle, cursor: "pointer" }
    : cardStyle;

  const hasLocation =
    initialType === "TBD" ||
    (initialType === "PHYSICAL" && (initialName || initialAddress)) ||
    (initialType === "VIRTUAL" && initialVirtualUrl);

  const locationCardInner =
    initialType === "PHYSICAL" ? (
      <>
        <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px" }}>{initialName}</div>
          {initialAddress && (
            <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>
              {initialAddress}
            </div>
          )}
        </div>
      </>
    ) : initialType === "VIRTUAL" ? (
      <>
        <Video size={18} style={{ color: t.accent, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px" }}>{translate("virtualEvent")}</div>
          <div style={{ color: t.textMuted, fontSize: "13px" }}>{translate("clickJoin")}</div>
        </div>
        {!isHost && <ExternalLink size={14} style={{ marginLeft: "auto", color: t.textMuted }} />}
      </>
    ) : (
      <>
        <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px" }}>{translate("determinedTbd")}</div>
          <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>
            {translate("locationDetailsAnnouncedLater")}
          </div>
        </div>
      </>
    );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Display */}
      {hasLocation ? (
        isHost ? (
          <div
            style={{ ...editCardStyle, justifyContent: "space-between" }}
            onClick={openPopover}
            title={translate("clickEditLocation")}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", flex: 1 }}>
              {locationCardInner}
            </div>
            <Pencil size={12} style={{ color: t.textMuted, flexShrink: 0, marginTop: "2px" }} />
          </div>
        ) : initialType === "PHYSICAL" && (initialName || initialAddress) ? (
          <>
            <div
              style={{ ...cardStyle, cursor: initialAddress ? "pointer" : "default" }}
              onClick={() => initialAddress && setMenuOpen((o) => !o)}
            >
              {locationCardInner}
            </div>
            {menuOpen && initialAddress && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  zIndex: 150,
                  background: t.cardBg,
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${t.cardBorder}`,
                  borderRadius: "14px",
                  overflow: "hidden",
                  minWidth: "220px",
                  boxShadow: t.cardShadow || "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                <a
                  href={buildMapUrl(initialAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 16px",
                    color: t.textPrimary,
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  <MapPin size={15} style={{ color: t.accent }} />
                  {translate("openMaps")}
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(initialAddress);
                    setCopied(true);
                    setTimeout(() => {
                      setCopied(false);
                      setMenuOpen(false);
                    }, 1200);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 16px",
                    width: "100%",
                    background: "none",
                    border: "none",
                    borderTop: `1px solid ${t.cardBorder}`,
                    color: t.textPrimary,
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <Check
                    size={15}
                    style={{ color: copied ? t.accent : "transparent", position: "absolute" }}
                  />
                  <span style={{ width: "15px", fontSize: "14px", opacity: copied ? 0 : 1 }}>
                    📋
                  </span>
                  {copied ? translate("copied") : translate("copyAddress")}
                </button>
              </div>
            )}
          </>
        ) : initialType === "VIRTUAL" && initialVirtualUrl ? (
          <a href={initialVirtualUrl} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            {locationCardInner}
          </a>
        ) : (
          <div style={cardStyle}>{locationCardInner}</div>
        )
      ) : isHost ? (
        <Button
          theme={t}
          variant="add"
          size="sm"
          onClick={openPopover}
          style={{ marginBottom: "24px" }}
        >
          <Plus size={14} aria-hidden="true" />
          {translate("addLocation")}
        </Button>
      ) : null}

      {/* Popover */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: hasLocation ? "calc(100% + 4px)" : "calc(100% - 16px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: t.cardBg,
            backdropFilter: "blur(20px)",
            border: `1px solid ${t.cardBorder}`,
            borderRadius: "16px",
            padding: "20px",
            boxSizing: "border-box",
            boxShadow: t.cardShadow || "0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <LocationFields
            value={{ type, name, address, virtualUrl: vUrl }}
            onChange={(location) => {
              setType(location.type);
              setName(location.name);
              setAddress(location.address);
              setVUrl(location.virtualUrl);
            }}
            theme={t}
          />

          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              theme={t}
              variant="primary"
              onClick={save}
              disabled={isPending}
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
  );
}
