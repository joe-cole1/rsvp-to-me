"use client";

import { useState, useRef, useEffect, useTransition } from "react";

// Cover images display at ~260px tall in a ~800px wide card. 1600×900 is
// plenty for 2× retina; quality 0.85 JPEG keeps file size under ~200KB.
function compressImage(file: File, maxW = 1600, maxH = 900, quality = 0.85): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
import { Settings, Plus, MapPin, Video, Users, MessageSquare, Send, X, Check, ExternalLink, Shirt, UtensilsCrossed, ParkingCircle, Link2, FileText, Pencil } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { saveEventField, saveEventDates, saveEventLocation, saveCoverImage, addRSVP, addComment, addInfoSection, updateInfoSection, removeInfoSection, approveRsvp, declineRsvp, sendSmsBlast, addEventUpdate, deleteEventUpdate, addPotluckItem, removePotluckItem, claimPotluckItem, unclaimPotluckItem } from "@/app/actions/event";
import { HostBar } from "./HostBar";
import { ThemePicker } from "./ThemePicker";

// ── Types ──────────────────────────────────────────────────────────────────────

type PendingRsvp = { id: string; guestName: string; guestEmail: string | null; status: "GOING" | "MAYBE" | "NO"; plusOneCount: number; createdAt: Date };

type EventData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  locationType: "PHYSICAL" | "VIRTUAL" | "TBD";
  locationName: string | null;
  locationAddress: string | null;
  virtualUrl: string | null;
  commentsEnabled: boolean;
  plusOneAllowed: boolean;
  plusOneMax: number;
  approvalRequired: boolean;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  host: { id: string; name: string | null; email: string };
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; accentColor: string; coverImageUrl: string | null } | null;
  infoSections: { id: string; type: string; title: string | null; content: string; url: string | null; order: number }[];
  rsvps: { id: string; guestName: string; status: "GOING" | "MAYBE" | "NO"; plusOneCount: number; note: string | null; createdAt: Date }[];
  comments: { id: string; guestName: string; body: string; createdAt: Date; replies: { id: string; guestName: string; body: string; createdAt: Date }[] }[];
  rsvpFields: { id: string; label: string; fieldType: string; required: boolean; options: string | null }[];
  updates: { id: string; body: string; notifyGuests: boolean; createdAt: Date }[];
  potluckItems: { id: string; label: string; claimedBy: string | null; claimedAt: Date | null }[];
  pendingRsvps: PendingRsvp[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz,
  });
}
function formatTime(d: Date, tz: string) {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: tz,
  });
}
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Convert a UTC Date to a "YYYY-MM-DDTHH:MM" string in the given timezone
function toDateTimeLocal(d: Date, tz: string): string {
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(d))) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}`;
}

// Convert "YYYY-MM-DDTHH:MM" in timezone tz back to a UTC Date (mirrors server logic)
function tzLocalToUtcClient(localStr: string, tz: string): Date {
  const asIfUtc = new Date(localStr + ":00Z");
  const parts: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(asIfUtc)) {
    parts[p.type] = p.value;
  }
  const h = parts.hour === "24" ? "00" : parts.hour;
  const localAsUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T${h}:${parts.minute}:${parts.second}Z`);
  return new Date(2 * asIfUtc.getTime() - localAsUtc.getTime());
}

const INFO_META: Record<string, { icon: React.ElementType; label: string }> = {
  DRESS_CODE: { icon: Shirt,            label: "Dress Code" },
  FOOD:       { icon: UtensilsCrossed,  label: "Food & Drinks" },
  PARKING:    { icon: ParkingCircle,    label: "Parking" },
  LINK:       { icon: Link2,            label: "Link" },
  CUSTOM:     { icon: FileText,         label: "More Info" },
};

const INFO_TYPES = ["DRESS_CODE", "FOOD", "PARKING", "LINK", "CUSTOM"] as const;

function buildMapUrl(address: string) {
  const encoded = encodeURIComponent(address);
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Mac/.test(navigator.userAgent)) {
    return `https://maps.apple.com/?q=${encoded}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

// ── Inline editable text ───────────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  style,
  isHost,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  isHost: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  if (!isHost) {
    return <span className={className} style={style}>{value || <span style={{ opacity: 0.4 }}>{placeholder}</span>}</span>;
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
      },
      autoFocus: true,
      style: { ...style, outline: "none", background: "transparent", width: "100%", border: "none", resize: "none" as const, fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", color: "inherit", letterSpacing: "inherit" },
      className,
    };
    return multiline ? <textarea rows={4} {...(shared as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} /> : <input {...(shared as React.InputHTMLAttributes<HTMLInputElement>)} />;
  }

  return (
    <span
      className={className}
      style={{ ...style, cursor: "text", borderBottom: "1.5px dashed rgba(255,255,255,0.15)" }}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </span>
  );
}

// ── Date/time inline editor ────────────────────────────────────────────────────

function DateEdit({
  startAt,
  endAt,
  timezone,
  eventId,
  isHost,
  theme: t,
  onSave,
}: {
  startAt: Date;
  endAt: Date | null;
  timezone: string;
  eventId: string;
  isHost: boolean;
  theme: ResolvedTheme;
  onSave: (start: Date, end: Date | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openPopover = () => {
    setStartVal(toDateTimeLocal(startAt, timezone));
    setEndVal(endAt ? toDateTimeLocal(endAt, timezone) : "");
    setOpen(true);
  };

  const save = () => {
    if (!startVal) return;
    startTransition(async () => {
      await saveEventDates(eventId, startVal, endVal || null);
      onSave(
        tzLocalToUtcClient(startVal, timezone),
        endVal ? tzLocalToUtcClient(endVal, timezone) : null
      );
      setOpen(false);
    });
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div
        style={{ marginBottom: "20px", cursor: isHost ? "pointer" : "default", display: "inline-block" }}
        onClick={isHost ? openPopover : undefined}
        title={isHost ? "Click to edit date/time" : undefined}
      >
        <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em", color: t.textPrimary, borderBottom: isHost ? "1.5px dashed rgba(255,255,255,0.2)" : "none" }}>
          {formatDate(startAt, timezone)}
        </div>
        <div style={{ fontSize: "16px", color: t.textSecondary, marginTop: "4px", fontWeight: 500 }}>
          {formatTime(startAt, timezone)}{endAt ? ` – ${formatTime(endAt, timezone)}` : ""}
        </div>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "rgba(13,13,22,0.97)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px",
          padding: "20px", minWidth: "264px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Start</label>
            <input
              type="datetime-local"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontFamily: "inherit", fontSize: "14px", colorScheme: "dark", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
              End <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="datetime-local"
                value={endVal}
                onChange={(e) => setEndVal(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontFamily: "inherit", fontSize: "14px", colorScheme: "dark" }}
              />
              {endVal && (
                <button onClick={() => setEndVal("")} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "0 10px" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "14px" }}>
            {timezone.replace(/_/g, " ")}
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={save}
              disabled={!startVal || isPending}
              style={{ flex: 1, background: "#a855f7", color: "#fff", border: "none", borderRadius: "10px", padding: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: !startVal || isPending ? "not-allowed" : "pointer", opacity: !startVal || isPending ? 0.5 : 1 }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Location inline editor ────────────────────────────────────────────────────

type LocationType = "PHYSICAL" | "VIRTUAL" | "TBD";

function LocationEdit({
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
  onSave: (data: { locationType: LocationType; locationName: string | null; locationAddress: string | null; virtualUrl: string | null }) => void;
}) {
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
      if (e.key === "Escape") { setOpen(false); setMenuOpen(false); }
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
    display: "flex", alignItems: "flex-start", gap: "12px", padding: "16px",
    borderRadius: t.cardRadius, background: t.cardBg, border: `1px solid ${t.cardBorder}`,
    backdropFilter: "blur(12px)", marginBottom: "24px", textDecoration: "none", color: "inherit",
  };

  const editCardStyle: React.CSSProperties = isHost
    ? { ...cardStyle, cursor: "pointer", borderStyle: "dashed" }
    : cardStyle;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px", background: active ? t.accent : "rgba(255,255,255,0.07)",
    color: active ? t.accentFg : "rgba(255,255,255,0.6)",
    border: active ? "none" : "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "10px",
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff", fontFamily: "inherit", fontSize: "14px", outline: "none", boxSizing: "border-box",
  };

  const hasLocation = (initialType === "PHYSICAL" && (initialName || initialAddress))
    || (initialType === "VIRTUAL" && initialVirtualUrl);

  const locationCardInner = initialType === "PHYSICAL" ? (
    <>
      <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: "15px" }}>{initialName}</div>
        {initialAddress && <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>{initialAddress}</div>}
      </div>
    </>
  ) : (
    <>
      <Video size={18} style={{ color: t.accent, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: "15px" }}>Virtual Event</div>
        <div style={{ color: t.textMuted, fontSize: "13px" }}>Click to join</div>
      </div>
      {!isHost && <ExternalLink size={14} style={{ marginLeft: "auto", color: t.textMuted }} />}
    </>
  );

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {/* Display */}
      {hasLocation ? (
        isHost ? (
          <div style={editCardStyle} onClick={openPopover} title="Click to edit location">
            {locationCardInner}
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
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 150,
                background: "rgba(13,13,22,0.97)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px",
                overflow: "hidden", minWidth: "220px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}>
                <a
                  href={buildMapUrl(initialAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", color: t.textPrimary, textDecoration: "none", fontSize: "14px", fontWeight: 600 }}
                >
                  <MapPin size={15} style={{ color: t.accent }} />
                  Open in Maps
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(initialAddress);
                    setCopied(true);
                    setTimeout(() => { setCopied(false); setMenuOpen(false); }, 1200);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", width: "100%", background: "none", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", color: t.textPrimary, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Check size={15} style={{ color: copied ? t.accent : "transparent", position: "absolute" }} />
                  <span style={{ width: "15px", fontSize: "14px", opacity: copied ? 0 : 1 }}>📋</span>
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
        <button
          onClick={openPopover}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "100px", background: t.accentBg, border: `1px dashed ${t.accentBorder}`, color: t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "24px" }}
        >
          <Plus size={13} />
          Add Location
        </button>
      ) : null}

      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", top: hasLocation ? "calc(100% + 4px)" : "calc(100% - 16px)", left: 0, zIndex: 200,
          background: "rgba(13,13,22,0.97)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: "16px",
          padding: "20px", minWidth: "280px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
        }}>
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
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Name</label>
                <input style={inputStyle} placeholder="Venue or place name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Address <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <input style={inputStyle} placeholder="123 Main St, City" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </>
          )}

          {type === "VIRTUAL" && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Link</label>
              <input style={inputStyle} placeholder="https://zoom.us/j/..." type="url" value={vUrl} onChange={(e) => setVUrl(e.target.value)} />
            </div>
          )}

          {type === "TBD" && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "14px" }}>Location will be hidden until you add details.</p>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={save}
              disabled={isPending}
              style={{ flex: 1, background: "#a855f7", color: "#fff", border: "none", borderRadius: "10px", padding: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function EventPage({ event: initial, isHost, theme, coverUploadEnabled = false }: { event: EventData; isHost: boolean; theme: ResolvedTheme; coverUploadEnabled?: boolean }) {
  const [event, setEvent] = useState(initial);
  const [rsvpStatus, setRsvpStatus] = useState<"GOING" | "MAYBE" | "NO" | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [plusOne, setPlusOne] = useState(0);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState({ title: "", content: "", url: "" });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", content: "", url: "" });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [rsvpNote, setRsvpNote] = useState("");
  const [updateDraft, setUpdateDraft] = useState("");
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true);
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [newPotluckLabel, setNewPotluckLabel] = useState("");
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = theme;

  // Derived
  const going = event.rsvps.filter((r) => r.status === "GOING");
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

  const existingTypes = new Set(event.infoSections.map((s) => s.type));
  const availableTypes = INFO_TYPES.filter((t) => t !== "CUSTOM" ? !existingTypes.has(t) : true);

  // Saves
  const save = (field: string, value: string) => {
    startTransition(async () => {
      await saveEventField(event.id, field, value);
      setEvent((e) => ({ ...e, [field]: value }));
    });
  };

  const [uploadStatus, setUploadStatus] = useState<"idle" | "compressing" | "uploading">("idle");

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      setUploadStatus("compressing");
      const compressed = await compressImage(file);
      setUploadStatus("uploading");
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      await saveCoverImage(event.id, url);
      setEvent((ev) => ({
        ...ev,
        theme: { ...(ev.theme ?? { baseTheme: "DARK" as const, accentColor: "#a855f7" }), coverImageUrl: url },
      }));
    } catch (err) {
      console.error("Cover upload failed:", err);
    } finally {
      setIsUploading(false);
      setUploadStatus("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitRSVP = async () => {
    if (!rsvpStatus || !guestName.trim()) return;
    startTransition(async () => {
      const result = await addRSVP({
        eventId: event.id,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        status: rsvpStatus,
        plusOneCount: plusOne,
        note: rsvpNote.trim() || undefined,
      });
      if (result.success) {
        setRsvpDone(true);
        if (!event.approvalRequired) {
          setEvent((e) => ({
            ...e,
            rsvps: [...e.rsvps, { id: result.id!, guestName: guestName.trim(), status: rsvpStatus, plusOneCount: plusOne, note: rsvpNote.trim() || null, createdAt: new Date() }],
          }));
        }
      }
    });
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    startTransition(async () => {
      const result = await addComment({ eventId: event.id, guestName: guestName || "Guest", body: commentText.trim() });
      if (result.success) {
        setCommentText("");
        setEvent((e) => ({
          ...e,
          comments: [{ id: result.id!, guestName: guestName || "Guest", body: commentText.trim(), createdAt: new Date(), replies: [] }, ...e.comments],
        }));
      }
    });
  };

  const commitInfoSection = async (type: string) => {
    if (!sectionDraft.content.trim() && !sectionDraft.url.trim()) return;
    startTransition(async () => {
      const result = await addInfoSection({
        eventId: event.id,
        type,
        title: sectionDraft.title || null,
        content: sectionDraft.content,
        url: sectionDraft.url || null,
        order: event.infoSections.length,
      });
      if (result.success) {
        setEvent((e) => ({
          ...e,
          infoSections: [...e.infoSections, { id: result.id!, type, title: sectionDraft.title || null, content: sectionDraft.content, url: sectionDraft.url || null, order: e.infoSections.length }],
        }));
        setAddingSection(null);
        setSectionDraft({ title: "", content: "", url: "" });
      }
    });
  };

  const deleteSection = async (id: string) => {
    startTransition(async () => {
      await removeInfoSection(id);
      setEvent((e) => ({ ...e, infoSections: e.infoSections.filter((s) => s.id !== id) }));
    });
  };

  const startEditSection = (sec: EventData["infoSections"][number]) => {
    setEditingSection(sec.id);
    setEditDraft({ title: sec.title ?? "", content: sec.content, url: sec.url ?? "" });
  };

  const commitEditSection = async (id: string, type: string) => {
    if (!editDraft.content.trim() && !editDraft.url.trim()) return;
    startTransition(async () => {
      await updateInfoSection(id, {
        title: type === "CUSTOM" ? editDraft.title || null : null,
        content: editDraft.content,
        url: editDraft.url || null,
      });
      setEvent((e) => ({
        ...e,
        infoSections: e.infoSections.map((s) =>
          s.id === id
            ? { ...s, title: type === "CUSTOM" ? editDraft.title || null : s.title, content: editDraft.content, url: editDraft.url || null }
            : s
        ),
      }));
      setEditingSection(null);
    });
  };

  const postUpdate = async () => {
    if (!updateDraft.trim() || isPostingUpdate) return;
    setIsPostingUpdate(true);
    try {
      const result = await addEventUpdate(event.id, updateDraft.trim(), notifyOnUpdate);
      if (result.success) {
        setEvent((e) => ({
          ...e,
          updates: [{ id: result.id!, body: updateDraft.trim(), notifyGuests: notifyOnUpdate, createdAt: result.createdAt! }, ...e.updates],
        }));
        setUpdateDraft("");
      }
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const removeUpdate = (id: string) => {
    startTransition(async () => {
      await deleteEventUpdate(id);
      setEvent((e) => ({ ...e, updates: e.updates.filter((u) => u.id !== id) }));
    });
  };

  const addItem = async () => {
    if (!newPotluckLabel.trim()) return;
    startTransition(async () => {
      const result = await addPotluckItem(event.id, newPotluckLabel.trim());
      if (result.success) {
        setEvent((e) => ({
          ...e,
          potluckItems: [...e.potluckItems, { id: result.id!, label: newPotluckLabel.trim(), claimedBy: null, claimedAt: null }],
        }));
        setNewPotluckLabel("");
      }
    });
  };

  const removeItem = (id: string) => {
    startTransition(async () => {
      await removePotluckItem(id);
      setEvent((e) => ({ ...e, potluckItems: e.potluckItems.filter((i) => i.id !== id) }));
    });
  };

  const claimItem = async (itemId: string, name: string) => {
    const result = await claimPotluckItem(itemId, name);
    if (result.success) {
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) => i.id === itemId ? { ...i, claimedBy: name, claimedAt: new Date() } : i),
      }));
      setClaimingItemId(null);
      setClaimName("");
    }
  };

  const unclaimItem = async (itemId: string, name: string) => {
    const result = await unclaimPotluckItem(itemId, name);
    if (result.success) {
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) => i.id === itemId ? { ...i, claimedBy: null, claimedAt: null } : i),
      }));
    }
  };

  const handleApprove = (rsvpId: string) => {
    startTransition(async () => {
      const result = await approveRsvp(rsvpId);
      if (result.success) {
        const pending = event.pendingRsvps.find((r) => r.id === rsvpId);
        setEvent((e) => ({
          ...e,
          pendingRsvps: e.pendingRsvps.filter((r) => r.id !== rsvpId),
          rsvps: pending
            ? [...e.rsvps, { id: pending.id, guestName: pending.guestName, status: pending.status, plusOneCount: pending.plusOneCount, note: null, createdAt: pending.createdAt }]
            : e.rsvps,
        }));
      }
    });
  };

  const handleDecline = (rsvpId: string) => {
    startTransition(async () => {
      const result = await declineRsvp(rsvpId);
      if (result.success) {
        setEvent((e) => ({ ...e, pendingRsvps: e.pendingRsvps.filter((r) => r.id !== rsvpId) }));
      }
    });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, position: "relative" as const, overflowX: "hidden" as const, fontFamily: "inherit" },
    container: { position: "relative" as const, zIndex: 1, maxWidth: "440px", margin: "0 auto", padding: "48px 16px 160px" },
    card: { background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "24px", marginBottom: "16px", backdropFilter: "blur(12px)" },
    badge: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", padding: "4px 12px", borderRadius: "100px", background: t.badgeBg, color: t.badgeText, border: `1px solid ${t.accentBorder}`, display: "inline-block" },
    inp: { width: "100%", padding: "12px 16px", borderRadius: t.btnRadius, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.inputText, fontFamily: "inherit", fontSize: "14px", outline: "none" },
    btn: { background: t.accent, color: t.accentFg, fontFamily: "inherit", fontSize: "14px", fontWeight: t.btnFontWeight, textTransform: t.btnTransform as React.CSSProperties["textTransform"], padding: "14px", border: "none", borderRadius: t.btnRadius, cursor: "pointer", width: "100%", boxShadow: t.accentShadow },
    mutedBtn: { background: t.inputBg, color: t.textSecondary, fontFamily: "inherit", fontSize: "13px", fontWeight: 600, padding: "10px 16px", border: `1px solid ${t.inputBorder}`, borderRadius: t.btnRadius, cursor: "pointer" },
    avatar: { width: "28px", height: "28px", borderRadius: "50%", background: t.avatarGradient, display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const, fontSize: "12px", fontWeight: 700, color: t.accentFg, flexShrink: 0, minWidth: "28px" },
  };

  // ── Cover ────────────────────────────────────────────────────────────────────

  const coverStyle: React.CSSProperties = event.theme?.coverImageUrl
    ? { backgroundImage: `url(${event.theme.coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(135deg, ${t.accent} 0%, #ec4899 100%)` };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Background decorations */}
      {t.pageDecoration === "dark-orbs" && (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: `radial-gradient(circle, rgba(${t.accent.replace("#","")},0.12) 0%, transparent 70%)`, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "soft-blobs" && (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: `radial-gradient(circle, ${t.accentBg} 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(196,181,253,0.35) 0%, transparent 70%)", filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "bold-hero" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "340px", background: `linear-gradient(135deg, ${t.accent} 0%, #ec4899 100%)`, zIndex: 0 }} />
      )}

      <div style={S.container}>

        {/* ── Cover image ── */}
        <div
          style={{ ...coverStyle, width: "100%", height: "260px", borderRadius: "20px", marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: t.pageDecoration === "dark-orbs" ? `0 0 60px ${t.accentBg}` : t.pageDecoration === "soft-blobs" ? "0 20px 60px rgba(0,0,0,0.08)" : "none" }}
        >
          {!event.theme?.coverImageUrl && <span style={{ fontSize: "72px" }}>🎉</span>}
          {isHost && (
            <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "6px" }}>
              <button
                onClick={() => setShowThemePicker(true)}
                style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
              >
                🎨 Theme
              </button>
              {coverUploadEnabled && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: isUploading ? "not-allowed" : "pointer", color: "#fff", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", opacity: isUploading ? 0.7 : 1 }}
                >
                  {uploadStatus === "compressing" ? "Compressing…" : uploadStatus === "uploading" ? "Uploading…" : "📷 Cover"}
                </button>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
        </div>

        {/* ── Date badges (inline editable for host) ── */}
        <DateEdit
          startAt={event.startAt}
          endAt={event.endAt}
          timezone={event.timezone}
          eventId={event.id}
          isHost={isHost}
          theme={t}
          onSave={(start, end) => setEvent((e) => ({ ...e, startAt: start, endAt: end }))}
        />

        {/* ── Title ── */}
        <h1 style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "8px", fontFamily: t.headingFont, color: t.textPrimary }}>
          <InlineEdit value={event.title} onSave={(v) => save("title", v)} placeholder="Event title" style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: t.headingFont }} isHost={isHost} />
        </h1>

        {/* ── Host byline ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", color: t.textSecondary, fontSize: "14px" }}>
          <div style={{ ...S.avatar, background: t.avatarGradient }}>{event.host.name?.[0] ?? event.host.email[0].toUpperCase()}</div>
          Hosted by {event.host.name ?? event.host.email}
        </div>

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
        <div style={{ ...S.card, background: "transparent", border: "none", padding: 0, marginBottom: "24px", backdropFilter: "none" }}>
          <p style={{ color: t.textSecondary, lineHeight: 1.7, fontSize: "15px", whiteSpace: "pre-wrap" }}>
            <InlineEdit value={event.description ?? ""} onSave={(v) => save("description", v)} placeholder="Add a description…" multiline style={{ color: t.textSecondary, lineHeight: "1.7", fontSize: "15px", whiteSpace: "pre-wrap", display: "block" }} isHost={isHost} />
          </p>
        </div>

        {/* ── Info sections ── */}
        {event.infoSections.length > 0 && (
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, backdropFilter: "blur(12px)", marginBottom: "16px", overflow: "hidden" }}>
            {event.infoSections.map((sec, i) => {
              const meta = INFO_META[sec.type] ?? INFO_META.CUSTOM;
              const Icon = meta.icon;
              const isEditing = editingSection === sec.id;
              return (
                <div key={sec.id} style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>
                  {isEditing ? (
                    <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {sec.type === "CUSTOM" && (
                        <input
                          style={S.inp}
                          placeholder="Section title"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                          autoFocus
                        />
                      )}
                      {sec.type === "LINK" ? (
                        <>
                          <input
                            style={S.inp}
                            placeholder="Label (e.g. Spotify Playlist)"
                            value={editDraft.content}
                            onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                            autoFocus
                          />
                          <input
                            style={S.inp}
                            placeholder="URL"
                            type="url"
                            value={editDraft.url}
                            onChange={(e) => setEditDraft((d) => ({ ...d, url: e.target.value }))}
                          />
                        </>
                      ) : (
                        <textarea
                          style={{ ...S.inp, resize: "none" } as React.CSSProperties}
                          rows={3}
                          placeholder="Details…"
                          value={editDraft.content}
                          onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                          autoFocus={sec.type !== "CUSTOM"}
                        />
                      )}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => commitEditSection(sec.id, sec.type)} style={{ ...S.btn, flex: 1, padding: "8px" }}>Save</button>
                        <button onClick={() => setEditingSection(null)} style={S.mutedBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "11px 16px" }}>
                      <Icon size={15} style={{ color: t.accent, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: "13px" }}>
                        <span style={{ fontWeight: 600, color: t.textPrimary }}>{sec.title ?? meta.label}</span>
                        {sec.content && <span style={{ color: t.textMuted }}> · </span>}
                        {sec.type === "LINK" && sec.url ? (
                          <a href={sec.url} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: "none" }}>
                            {sec.content} <ExternalLink size={11} style={{ display: "inline", verticalAlign: "middle" }} />
                          </a>
                        ) : (
                          <span style={{ color: t.textSecondary }}>{sec.content}</span>
                        )}
                      </div>
                      {isHost && (
                        <>
                          <button onClick={() => startEditSection(sec)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0 }}>
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteSection(sec.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Add info section chips (host only) ── */}
        {isHost && availableTypes.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
            {availableTypes.map((type) => {
              const meta = INFO_META[type];
              return (
                <button
                  key={type}
                  onClick={() => { setAddingSection(type); setSectionDraft({ title: "", content: "", url: "" }); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "100px", background: t.accentBg, border: `1px dashed ${t.accentBorder}`, color: t.textMuted, fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <Plus size={13} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Add section inline form ── */}
        {addingSection && (
          <div style={{ ...S.card, marginBottom: "24px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
              {INFO_META[addingSection]?.label}
            </div>
            {addingSection === "CUSTOM" && (
              <input
                style={{ ...S.inp, marginBottom: "10px" }}
                placeholder="Section title"
                value={sectionDraft.title}
                onChange={(e) => setSectionDraft((d) => ({ ...d, title: e.target.value }))}
              />
            )}
            {addingSection === "LINK" ? (
              <>
                <input
                  style={{ ...S.inp, marginBottom: "10px" }}
                  placeholder="Label (e.g. Spotify Playlist)"
                  value={sectionDraft.content}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
                />
                <input
                  style={{ ...S.inp, marginBottom: "10px" }}
                  placeholder="URL"
                  type="url"
                  value={sectionDraft.url}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, url: e.target.value }))}
                />
              </>
            ) : (
              <textarea
                style={{ ...S.inp, resize: "none", marginBottom: "10px" } as React.CSSProperties}
                rows={3}
                placeholder="Details…"
                value={sectionDraft.content}
                onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
              />
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => commitInfoSection(addingSection)} style={{ ...S.btn, flex: 1, padding: "10px" }}>Save</button>
              <button onClick={() => setAddingSection(null)} style={{ ...S.mutedBtn }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Event updates ── */}
        {(event.updates.length > 0 || isHost) && (
          <div style={{ marginBottom: "16px" }}>
            {event.updates.map((u) => (
              <div key={u.id} style={{ ...S.card, marginBottom: "8px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>📣</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", color: t.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{u.body}</p>
                  <span style={{ fontSize: "11px", color: t.textMuted, marginTop: "6px", display: "block" }}>{timeAgo(u.createdAt)}</span>
                </div>
                {isHost && (
                  <button onClick={() => removeUpdate(u.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            {isHost && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: t.textMuted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "10px" }}>Post an Update</div>
                <textarea
                  style={{ ...S.inp, resize: "none", marginBottom: "10px" } as React.CSSProperties}
                  rows={3}
                  placeholder="Changed start time, new location, what to bring…"
                  value={updateDraft}
                  onChange={(e) => setUpdateDraft(e.target.value)}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: t.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={notifyOnUpdate} onChange={(e) => setNotifyOnUpdate(e.target.checked)} style={{ accentColor: t.accent }} />
                    Notify guests via email
                  </label>
                  <button
                    onClick={postUpdate}
                    disabled={!updateDraft.trim() || isPostingUpdate}
                    style={{ ...S.btn, width: "auto", padding: "10px 20px", opacity: !updateDraft.trim() || isPostingUpdate ? 0.5 : 1 }}
                  >
                    {isPostingUpdate ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Potluck ── */}
        {(event.potluckItems.length > 0 || isHost) && (
          <div style={{ ...S.card, marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
              <span style={{ fontSize: "16px" }}>🍽️</span>
              <span style={{ fontWeight: 700 }}>What to Bring</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: event.potluckItems.length > 0 ? "12px" : 0 }}>
              {event.potluckItems.map((item) => (
                <div key={item.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>{item.label}</span>
                      {item.claimedBy && (
                        <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>
                          ✓ {item.claimedBy}
                        </span>
                      )}
                    </div>
                    {!item.claimedBy && !isHost && claimingItemId !== item.id && (
                      <button
                        onClick={() => { setClaimingItemId(item.id); setClaimName(guestName); }}
                        style={{ ...S.mutedBtn, padding: "6px 12px", fontSize: "12px" }}
                      >
                        I&apos;ll bring it
                      </button>
                    )}
                    {item.claimedBy && !isHost && item.claimedBy === guestName && (
                      <button
                        onClick={() => unclaimItem(item.id, guestName)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: "12px", padding: "4px" }}
                      >
                        Unclaim
                      </button>
                    )}
                    {isHost && (
                      <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0 }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {claimingItemId === item.id && (
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                      <input
                        style={{ ...S.inp, flex: 1 }}
                        placeholder="Your name"
                        value={claimName}
                        onChange={(e) => setClaimName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && claimName.trim()) claimItem(item.id, claimName.trim()); }}
                        autoFocus
                      />
                      <button
                        onClick={() => claimName.trim() && claimItem(item.id, claimName.trim())}
                        disabled={!claimName.trim()}
                        style={{ ...S.btn, width: "auto", padding: "10px 16px", opacity: !claimName.trim() ? 0.5 : 1 }}
                      >
                        Claim
                      </button>
                      <button onClick={() => setClaimingItemId(null)} style={S.mutedBtn}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isHost && (
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  style={{ ...S.inp, flex: 1 }}
                  placeholder="Add an item (e.g. wine, dessert, chairs)"
                  value={newPotluckLabel}
                  onChange={(e) => setNewPotluckLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newPotluckLabel.trim()) addItem(); }}
                />
                <button
                  onClick={addItem}
                  disabled={!newPotluckLabel.trim() || isPending}
                  style={{ ...S.btn, width: "auto", padding: "10px 16px", opacity: !newPotluckLabel.trim() ? 0.5 : 1 }}
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RSVP Section ── */}
        {!isHost && (
          <div style={S.card}>
            <h2 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "16px", fontFamily: t.headingFont }}>Are you coming?</h2>

            {rsvpDone ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>
                  {rsvpStatus === "GOING" ? "🎉" : rsvpStatus === "MAYBE" ? "🤔" : "😔"}
                </div>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                  {rsvpStatus === "GOING" ? "You're going!" : rsvpStatus === "MAYBE" ? "Marked as maybe" : "Can't make it"}
                </div>
                <div style={{ fontSize: "13px", color: t.textMuted }}>
                  {event.approvalRequired
                    ? "Your RSVP is pending approval."
                    : guestEmail && guestPhone
                      ? "Confirmation sent to your email and phone."
                      : guestEmail
                        ? "A confirmation was sent to your email."
                        : guestPhone
                          ? "A confirmation was sent to your phone."
                          : "Thanks for responding!"}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                  {(["GOING", "MAYBE", "NO"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setRsvpStatus(s)}
                      style={{
                        flex: 1, padding: "12px 8px", border: "none", borderRadius: t.btnRadius, cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: t.btnFontWeight,
                        ...(rsvpStatus === s
                          ? { background: t.accent, color: t.accentFg, boxShadow: t.accentShadow }
                          : { background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}` }),
                      }}
                    >
                      <div style={{ fontSize: "20px", marginBottom: "4px" }}>
                        {s === "GOING" ? "🎉" : s === "MAYBE" ? "🤔" : "😔"}
                      </div>
                      {s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't go"}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input style={S.inp} placeholder="Your name *" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                  <input style={S.inp} type="email" placeholder="Email (optional — for updates)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                  <input style={S.inp} type="tel" placeholder="Phone (optional — for SMS updates)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
                  <textarea
                    style={{ ...S.inp, resize: "none" } as React.CSSProperties}
                    rows={2}
                    placeholder="Message for the host (optional)"
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                  />
                  {event.plusOneAllowed && event.plusOneMax > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "14px", color: t.textSecondary, flex: 1 }}>Bringing a +1?</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {Array.from({ length: event.plusOneMax + 1 }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => setPlusOne(i)}
                            style={{ width: "36px", height: "36px", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, background: plusOne === i ? t.accent : t.inputBg, color: plusOne === i ? t.accentFg : t.textSecondary }}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={submitRSVP}
                    disabled={!rsvpStatus || !guestName.trim() || isPending}
                    style={{ ...S.btn, opacity: (!rsvpStatus || !guestName.trim()) ? 0.5 : 1 }}
                  >
                    {isPending ? "Sending…" : "Send RSVP"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Pending approvals (host only) ── */}
        {isHost && event.pendingRsvps.length > 0 && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
              <Users size={16} style={{ color: t.accent }} />
              <span style={{ fontWeight: 700 }}>Pending Approval ({event.pendingRsvps.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {event.pendingRsvps.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: i < event.pendingRsvps.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                  <div style={S.avatar}>{r.guestName[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{r.guestName}</div>
                    <div style={{ color: t.textMuted, fontSize: "12px" }}>
                      {r.status.toLowerCase()}{r.plusOneCount > 0 ? ` +${r.plusOneCount}` : ""}
                      {r.guestEmail ? ` · ${r.guestEmail}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={isPending}
                    style={{ background: t.accent, color: t.accentFg, border: "none", borderRadius: "8px", padding: "6px 14px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                    title="Approve"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleDecline(r.id)}
                    disabled={isPending}
                    style={{ background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}`, borderRadius: "8px", padding: "6px 14px", fontFamily: "inherit", fontSize: "13px", cursor: "pointer" }}
                    title="Decline"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Guest List ── */}
        {(event.guestListVis === "ALL" || isHost) && going.length > 0 && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={16} style={{ color: t.accent }} />
                <span style={{ fontWeight: 700 }}>Going ({totalGoing})</span>
              </div>
              {maybe.length > 0 && <span style={{ color: t.textMuted, fontSize: "13px" }}>{maybe.length} maybe</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {going.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: r.note ? "flex-start" : "center", gap: "8px", padding: "6px 12px", borderRadius: "14px", background: t.pillBg, border: `1px solid ${t.pillBorder}`, fontSize: "13px" }}>
                  <div style={{ ...S.avatar, width: "20px", height: "20px", fontSize: "10px", minWidth: "20px", marginTop: r.note ? "2px" : 0 }}>{r.guestName[0].toUpperCase()}</div>
                  <div>
                    <div>{r.guestName}{r.plusOneCount > 0 && ` +${r.plusOneCount}`}</div>
                    {r.note && <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "2px" }}>{r.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Comments ── */}
        {event.commentsEnabled && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
              <MessageSquare size={16} style={{ color: t.accent }} />
              <span style={{ fontWeight: 700 }}>Vibes</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
              {event.comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "10px" }}>
                  <div style={{ ...S.avatar }}>{c.guestName[0].toUpperCase()}</div>
                  <div style={{ flex: 1, background: t.inputBg, borderRadius: "14px", padding: "10px 14px" }}>
                    <span style={{ fontWeight: 700, fontSize: "13px" }}>{c.guestName}</span>
                    <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "8px" }}>{timeAgo(c.createdAt)}</span>
                    <p style={{ color: t.textSecondary, fontSize: "14px", marginTop: "4px" }}>{c.body}</p>
                  </div>
                </div>
              ))}
              {event.comments.length === 0 && (
                <p style={{ color: t.textMuted, fontSize: "14px", textAlign: "center", padding: "12px 0" }}>Be the first to comment!</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{ ...S.inp, flex: 1 }}
                placeholder={guestName ? `Comment as ${guestName}…` : "Your name first, then comment below"}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || isPending}
                style={{ background: t.accent, color: t.accentFg, border: "none", borderRadius: t.btnRadius, padding: "0 16px", cursor: "pointer", opacity: !commentText.trim() ? 0.5 : 1 }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "32px", fontSize: "12px", color: t.textMuted, opacity: 0.5 }}>rsvp to me</p>
      </div>

      {/* ── Host Bar ── */}
      {isHost && <HostBar eventId={event.id} eventSlug={event.slug} theme={t} visibility={event.visibility} />}

      {/* ── Settings link (gear icon, top right) ── */}
      {isHost && (
        <a
          href={`/e/${event.slug}/settings`}
          style={{ position: "fixed", top: "16px", right: "16px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "8px", zIndex: 100, color: "#fff", display: "flex", alignItems: "center", textDecoration: "none" }}
          title="Event settings"
        >
          <Settings size={18} />
        </a>
      )}

      {/* ── Theme Picker Modal ── */}
      {showThemePicker && (
        <ThemePicker
          eventId={event.id}
          current={{ base: event.theme?.baseTheme ?? "DARK", accent: event.theme?.accentColor ?? "#a855f7" }}
          onClose={() => setShowThemePicker(false)}
          onSave={() => {
            setShowThemePicker(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
