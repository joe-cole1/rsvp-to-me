"use client";

import { Plus, MapPin, Video, Check, ExternalLink, Pencil } from "lucide-react";
import { useState, useRef, useEffect, useTransition } from "react";
import { saveEventLocation } from "@/app/actions/event";
import type { ResolvedTheme } from "@/lib/theme";
import type { LocationType } from "./types";
import { buildMapUrl } from "./helpers";

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
  const getChipStyle = (): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 14px",
    borderRadius: "100px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: "24px",
    transition: "all 0.2s ease",
    background: t.cardBg,
    border: `1px dashed ${t.accentBorder}`,
    color: t.accent,
  });
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [type, setType] = useState<LocationType>(initialType);
  const [name, setName] = useState(initialName ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [vUrl, setVUrl] = useState(initialVirtualUrl ?? "");
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

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
      await saveEventLocation(eventId, {
        locationType: type,
        locationName: type === "PHYSICAL" ? name || null : null,
        locationAddress: type === "PHYSICAL" ? address || null : null,
        virtualUrl: type === "VIRTUAL" ? vUrl || null : null,
      });
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

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 4px",
    background: active ? t.accent : t.inputBg,
    color: active ? t.accentFg : t.textSecondary,
    border: active ? "none" : `1px solid ${t.inputBorder}`,
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    background: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    color: t.textPrimary,
    fontFamily: "inherit",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

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
          <div style={{ fontWeight: 600, fontSize: "15px" }}>Virtual Event</div>
          <div style={{ color: t.textMuted, fontSize: "13px" }}>Click to join</div>
        </div>
        {!isHost && <ExternalLink size={14} style={{ marginLeft: "auto", color: t.textMuted }} />}
      </>
    ) : (
      <>
        <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px" }}>To Be Determined (TBD)</div>
          <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>
            Location details will be announced later
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
            title="Click to edit location"
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
                  Open in Maps
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
                  {copied ? "Copied!" : "Copy address"}
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
        <button onClick={openPopover} className="chip-button" style={getChipStyle()}>
          <Plus size={13} />
          Add Location
        </button>
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
          {/* Type tabs */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {(["PHYSICAL", "VIRTUAL", "TBD"] as LocationType[]).map((lt) => (
              <button key={lt} style={tabStyle(type === lt)} onClick={() => setType(lt)}>
                {lt === "PHYSICAL" ? "📍 Physical" : lt === "VIRTUAL" ? "💻 Virtual" : "📅 TBD"}
              </button>
            ))}
          </div>

          {type === "PHYSICAL" && (
            <>
              <div style={{ marginBottom: "10px" }}>
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
                  Name
                </label>
                <input
                  style={inputStyle}
                  placeholder="Venue or place name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
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
                  Address{" "}
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    (optional)
                  </span>
                </label>
                <input
                  style={inputStyle}
                  placeholder="123 Main St, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </>
          )}

          {type === "VIRTUAL" && (
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
                Link
              </label>
              <input
                style={inputStyle}
                placeholder="https://zoom.us/j/..."
                type="url"
                value={vUrl}
                onChange={(e) => setVUrl(e.target.value)}
              />
            </div>
          )}

          {type === "TBD" && (
            <p style={{ fontSize: "13px", color: t.textMuted, marginBottom: "14px" }}>
              We&apos;ll show &quot;To Be Determined (TBD)&quot; to guests until details are added.
            </p>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={save}
              disabled={isPending}
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
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.5 : 1,
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
  );
}
