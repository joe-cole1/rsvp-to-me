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
import { Settings, Plus, MapPin, Video, Users, MessageSquare, Send, X, Check, ExternalLink, Shirt, UtensilsCrossed, ParkingCircle, Link2, FileText, Pencil, Info, Music, Gift, Bed, Calendar, CalendarPlus, Sparkles, Camera, Phone, DollarSign, Wallet } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { saveEventField, saveEventDates, saveEventLocation, saveCoverImage, addComment, addInfoSection, updateInfoSection, removeInfoSection, approveRsvp, declineRsvp, addEventUpdate, deleteEventUpdate, addPotluckItem, removePotluckItem, claimPotluckItem, unclaimPotluckItem, deleteActivityEvent } from "@/app/actions/event";
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
  plusOneNamesRequired: boolean;
  guestSharingEnabled: boolean;
  approvalRequired: boolean;
  maybeEnabled: boolean;
  questionnaireEnabled: boolean;
  showTimestamps: boolean;
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  host: { id: string; name: string | null; email: string };
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; accentColor: string; coverImageUrl: string | null } | null;
  infoSections: { id: string; type: string; title: string | null; content: string; url: string | null; order: number }[];
  rsvps: { id: string; guestName: string; status: "GOING" | "MAYBE" | "NO"; plusOneCount: number; note: string | null; createdAt: Date }[];
  comments: { id: string; guestName: string; body: string; createdAt: Date; replies: { id: string; guestName: string; body: string; createdAt: Date }[] }[];
  rsvpFields: { id: string; label: string; fieldType: string; required: boolean; options: string | null }[];
  updates: { id: string; body: string; notifyGuests: boolean; createdAt: Date }[];
  potluckItems: { id: string; label: string; quantity: number; claimedQty: number | null; claimedBy: string | null; claimedAt: Date | null }[];
  pendingRsvps: PendingRsvp[];
  activityEvents: { id: string; type: string; actorName: string | null; detail: string; createdAt: Date }[];
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

const ICON_SET: { key: string; icon: React.ElementType; label: string }[] = [
  { key: "shirt",    icon: Shirt,           label: "Dress code"    },
  { key: "utensils", icon: UtensilsCrossed, label: "Food & drinks" },
  { key: "parking",  icon: ParkingCircle,   label: "Parking"       },
  { key: "link",     icon: Link2,           label: "Link"          },
  { key: "info",     icon: Info,            label: "Info"          },
  { key: "music",    icon: Music,           label: "Music"         },
  { key: "gift",     icon: Gift,            label: "Gift registry" },
  { key: "bed",      icon: Bed,             label: "Accommodation" },
  { key: "mappin",   icon: MapPin,          label: "Getting here"  },
  { key: "calendar", icon: Calendar,        label: "Schedule"      },
  { key: "sparkles", icon: Sparkles,        label: "Vibes"         },
  { key: "filetext", icon: FileText,        label: "Notes"         },
  { key: "camera",   icon: Camera,          label: "Photos"        },
  { key: "phone",    icon: Phone,           label: "Contact"       },
  { key: "zelle",    icon: DollarSign,      label: "Zelle"         },
  { key: "venmo",    icon: Wallet,          label: "Venmo"         },
];

const PRESET_CHIPS = [
  { key: "link",     label: "Link",            icon: Link2 },
  { key: "gift",     label: "Registry",        icon: Gift },
  { key: "shirt",    label: "Dress Code",      icon: Shirt },
  { key: "utensils", label: "Food Situation",  icon: UtensilsCrossed },
  { key: "parking",  label: "Parking",         icon: ParkingCircle },
  { key: "bed",      label: "Accommodations",  icon: Bed },
  { key: "info",     label: "Additional Info", icon: Info },
  { key: "zelle",    label: "Zelle",           icon: DollarSign },
  { key: "venmo",    label: "Venmo",           icon: Wallet },
];

// Maps legacy enum type values to new icon keys
const LEGACY_ICON_MAP: Record<string, string> = {
  DRESS_CODE: "shirt",
  FOOD:       "utensils",
  PARKING:    "parking",
  LINK:       "link",
  CUSTOM:     "filetext",
};

function resolveIconKey(stored: string): string {
  return LEGACY_ICON_MAP[stored] ?? stored;
}

function getIconItem(stored: string) {
  const key = resolveIconKey(stored);
  return ICON_SET.find((i) => i.key === key) ?? ICON_SET.find((i) => i.key === "filetext")!;
}

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
        display: "block", padding: "10px 16px", color: t.textPrimary,
        textDecoration: "none", fontSize: "14px", fontWeight: 500,
        background: hover ? t.inputBg : "transparent", cursor: "pointer",
        textAlign: "left", borderRadius: "8px"
      }}
    >
      {children}
    </a>
  );
};

function DateEdit({
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
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
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
    "END:VCALENDAR"
  ].join("\r\n");
  const icalDataUri = "data:text/calendar;charset=utf-8," + encodeURIComponent(icalContent);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
      {/* Calendar icon button */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setCalOpen(!calOpen)}
          style={{
            background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: "12px",
            color: t.textSecondary, cursor: "pointer", width: "48px", height: "48px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxSizing: "border-box", transition: "all 0.2s ease"
          }}
          title="Add to Calendar"
        >
          <CalendarPlus size={22} />
        </button>
        {calOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
            background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: "12px",
            padding: "6px", minWidth: "180px", boxShadow: t.cardShadow || "0 10px 30px rgba(0,0,0,0.15)",
            backdropFilter: "blur(20px)",
            display: "flex", flexDirection: "column", gap: "2px"
          }}>
            <CalendarMenuItem href={gcalUrl} target="_blank" rel="noopener noreferrer" onClick={() => setCalOpen(false)} theme={t}>
              Google Calendar
            </CalendarMenuItem>
            <CalendarMenuItem href={icalDataUri} download={`${eventTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`} onClick={() => setCalOpen(false)} theme={t}>
              iCal / Outlook (.ics)
            </CalendarMenuItem>
          </div>
        )}
      </div>

      <div>
        <div
          style={{ cursor: isHost ? "pointer" : "default", display: "inline-block" }}
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
            background: t.cardBg, backdropFilter: "blur(20px)",
            border: `1px solid ${t.cardBorder}`, borderRadius: "16px",
            padding: "20px", minWidth: "264px",
            boxShadow: t.cardShadow || "0 20px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: "6px" }}>Start</label>
              <input
                type="datetime-local"
                value={startVal}
                onChange={(e) => setStartVal(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.textPrimary, fontFamily: "inherit", fontSize: "14px", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: "6px" }}>
                End <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  type="datetime-local"
                  value={endVal}
                  onChange={(e) => setEndVal(e.target.value)}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.textPrimary, fontFamily: "inherit", fontSize: "14px", colorScheme: t.textPrimary === "#ffffff" ? "dark" : "light" }}
                />
                {endVal && (
                  <button onClick={() => setEndVal("")} style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", color: t.textSecondary, cursor: "pointer", padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                disabled={!startVal || isPending}
                style={{ flex: 1, background: t.accent, color: t.accentFg, border: "none", borderRadius: "10px", padding: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: !startVal || isPending ? "not-allowed" : "pointer", opacity: !startVal || isPending ? 0.5 : 1 }}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", padding: "10px 14px", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
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
  baseTheme = "DARK",
}: {
  eventId: string;
  locationType: LocationType;
  locationName: string | null;
  locationAddress: string | null;
  virtualUrl: string | null;
  isHost: boolean;
  theme: ResolvedTheme;
  onSave: (data: { locationType: LocationType; locationName: string | null; locationAddress: string | null; virtualUrl: string | null }) => void;
  baseTheme?: "DARK" | "SOFT" | "BOLD";
}) {
  const getChipStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
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
    };

    if (baseTheme === "SOFT") {
      return {
        ...baseStyle,
        background: t.accentBg,
        border: `1px dashed ${t.accentBorder}`,
        color: t.accent,
      };
    } else if (baseTheme === "BOLD") {
      return {
        ...baseStyle,
        background: `rgba(${t.accentRgb}, 0.08)`,
        border: `1px dashed rgba(${t.accentRgb}, 0.3)`,
        color: t.accent,
      };
    } else {
      // DARK
      return {
        ...baseStyle,
        background: `rgba(${t.accentRgb}, 0.15)`,
        border: `1px dashed rgba(${t.accentRgb}, 0.35)`,
        color: t.accent,
      };
    }
  };
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
    flex: 1, padding: "8px", background: active ? t.accent : t.inputBg,
    color: active ? t.accentFg : t.textSecondary,
    border: active ? "none" : `1px solid ${t.inputBorder}`,
    borderRadius: "8px", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "10px",
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    color: t.textPrimary, fontFamily: "inherit", fontSize: "14px", outline: "none", boxSizing: "border-box",
  };

  const hasLocation = initialType === "TBD"
    || (initialType === "PHYSICAL" && (initialName || initialAddress))
    || (initialType === "VIRTUAL" && initialVirtualUrl);

  const locationCardInner = initialType === "PHYSICAL" ? (
    <>
      <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
      <div>
        <div style={{ fontWeight: 600, fontSize: "15px" }}>{initialName}</div>
        {initialAddress && <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>{initialAddress}</div>}
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
        <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>Location details will be announced later</div>
      </div>
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
                background: t.cardBg, backdropFilter: "blur(20px)",
                border: `1px solid ${t.cardBorder}`, borderRadius: "14px",
                overflow: "hidden", minWidth: "220px",
                boxShadow: t.cardShadow || "0 12px 40px rgba(0,0,0,0.5)",
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
                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", width: "100%", background: "none", border: "none", borderTop: `1px solid ${t.cardBorder}`, color: t.textPrimary, fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
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
          className="chip-button"
          style={getChipStyle()}
        >
          <Plus size={13} />
          Add Location
        </button>
      ) : null}

      {/* Popover */}
      {open && (
        <div style={{
          position: "absolute", top: hasLocation ? "calc(100% + 4px)" : "calc(100% - 16px)", left: 0, zIndex: 200,
          background: t.cardBg, backdropFilter: "blur(20px)",
          border: `1px solid ${t.cardBorder}`, borderRadius: "16px",
          padding: "20px", minWidth: "280px",
          boxShadow: t.cardShadow || "0 20px 60px rgba(0,0,0,0.6)",
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
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: "6px" }}>Name</label>
                <input style={inputStyle} placeholder="Venue or place name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: "6px" }}>Address <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                <input style={inputStyle} placeholder="123 Main St, City" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </>
          )}

          {type === "VIRTUAL" && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, marginBottom: "6px" }}>Link</label>
              <input style={inputStyle} placeholder="https://zoom.us/j/..." type="url" value={vUrl} onChange={(e) => setVUrl(e.target.value)} />
            </div>
          )}

          {type === "TBD" && (
            <p style={{ fontSize: "13px", color: t.textMuted, marginBottom: "14px" }}>We&apos;ll show &quot;To Be Determined (TBD)&quot; to guests until details are added.</p>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={save}
              disabled={isPending}
              style={{ flex: 1, background: t.accent, color: t.accentFg, border: "none", borderRadius: "10px", padding: "10px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: t.inputBg, color: t.textSecondary, border: `1px solid ${t.inputBorder}`, borderRadius: "10px", padding: "10px 14px", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icon picker strip ──────────────────────────────────────────────────────────

function IconPicker({ selected, onSelect, t }: { selected: string; onSelect: (key: string) => void; t: ResolvedTheme }) {
  return (
    <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "10px", marginBottom: "4px" }}>
      {ICON_SET.map(({ key, icon: IconComp }) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          title={ICON_SET.find((i) => i.key === key)?.label}
          style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: selected === key ? t.accentBg : t.inputBg,
            border: selected === key ? `2px solid ${t.accent}` : "2px solid transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0,
          }}
        >
          <IconComp size={16} style={{ color: selected === key ? t.accent : t.textMuted }} />
        </button>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function getPlaceholder(key: string) {
  switch (key) {
    case "link": return "Link details (e.g. Group chat, playlist)...";
    case "gift": return "Registry details (e.g. Target, Amazon)...";
    case "shirt": return "Dress Code (e.g. Cocktail, Casual, Festive)...";
    case "utensils": return "Food Situation (e.g. BYOB, dinner provided, potluck)...";
    case "parking": return "Parking information (e.g. Street parking, driveway)...";
    case "bed": return "Accommodations (e.g. Hotel block, house details)...";
    case "info": return "Additional Info...";
    case "zelle": return "Zelle details (e.g. Phone, email, or name)...";
    case "venmo": return "Venmo username (e.g. @username)...";
    default: return "Details…";
  }
}

type GuestRsvp = { id: string; guestName: string; editToken: string; status: "GOING" | "MAYBE" | "NO"; hasAnswers: boolean };

export function EventPage({ event: initial, isHost, theme, coverUploadEnabled = false, guestRsvp = null, sessionUser = null }: { event: EventData; isHost: boolean; theme: ResolvedTheme; coverUploadEnabled?: boolean; guestRsvp?: GuestRsvp | null; sessionUser?: { email: string } | null }) {
  const [event, setEvent] = useState(initial);
  const [guestName] = useState(guestRsvp?.guestName ?? "");
  const [guestRsvpId] = useState<string | null>(guestRsvp?.id ?? null);
  const [guestEditToken] = useState<string | null>(guestRsvp?.editToken ?? null);
  const rsvpStatus = guestRsvp?.status ?? null;
  const rsvpDone = !!guestRsvp?.id;
  const [pendingDelete, setPendingDelete] = useState<{ id: string; section: EventData["infoSections"][number]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionDraft, setSectionDraft] = useState({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [updateDraft, setUpdateDraft] = useState("");
  const [notifyOnUpdate, setNotifyOnUpdate] = useState(true);
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [newPotluckLabel, setNewPotluckLabel] = useState("");
  const [claimingItemId, setClaimingItemId] = useState<string | null>(null);
  const [claimName, setClaimName] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showShareQr, setShowShareQr] = useState(false);
  const [activeApproval, setActiveApproval] = useState<{ rsvpId: string; type: "APPROVE" | "DECLINE"; guestName: string } | null>(null);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [newPotluckQty, setNewPotluckQty] = useState(1);
  const [claimQty, setClaimQty] = useState(1);

  const t = theme;

  const getChipStyle = (isCustom: boolean): React.CSSProperties => {
    const baseTheme = event.theme?.baseTheme ?? "DARK";
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 14px",
      borderRadius: "100px",
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "all 0.2s ease",
    };

    if (baseTheme === "SOFT") {
      return {
        ...baseStyle,
        background: t.accentBg,
        border: isCustom ? `1px dashed ${t.accentBorder}` : "none",
        color: t.accent,
      };
    } else if (baseTheme === "BOLD") {
      return {
        ...baseStyle,
        background: `rgba(${t.accentRgb}, 0.08)`,
        border: isCustom ? `1px dashed rgba(${t.accentRgb}, 0.3)` : `1px solid rgba(${t.accentRgb}, 0.2)`,
        color: t.accent,
      };
    } else {
      // DARK
      return {
        ...baseStyle,
        background: `rgba(${t.accentRgb}, 0.15)`,
        border: isCustom ? `1px dashed rgba(${t.accentRgb}, 0.35)` : `1px solid rgba(${t.accentRgb}, 0.25)`,
        color: t.accent,
      };
    }
  };

  // Derived
  const going = event.rsvps.filter((r) => r.status === "GOING");
  const maybe = event.rsvps.filter((r) => r.status === "MAYBE");
  const no = event.rsvps.filter((r) => r.status === "NO");
  const totalGoing = going.reduce((s, r) => s + 1 + r.plusOneCount, 0);

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

  const submitComment = async () => {
    if (!commentText.trim()) return;
    startTransition(async () => {
      const result = await addComment({ eventId: event.id, guestName: guestName || "Guest", body: commentText.trim(), rsvpId: guestRsvpId ?? undefined });
      if (result.success) {
        setCommentText("");
        setEvent((e) => ({
          ...e,
          comments: [{ id: result.id!, guestName: guestName || "Guest", body: commentText.trim(), createdAt: new Date(), replies: [] }, ...e.comments],
        }));
      }
    });
  };

  const commitInfoSection = async () => {
    if (!sectionDraft.content.trim() && !sectionDraft.url.trim()) return;
    startTransition(async () => {
      const result = await addInfoSection({
        eventId: event.id,
        type: sectionDraft.iconKey,
        title: sectionDraft.title.trim() || null,
        content: sectionDraft.content,
        url: sectionDraft.url || null,
        order: event.infoSections.length,
      });
      if (result.success) {
        setEvent((e) => ({
          ...e,
          infoSections: [...e.infoSections, { id: result.id!, type: sectionDraft.iconKey, title: sectionDraft.title.trim() || null, content: sectionDraft.content, url: sectionDraft.url || null, order: e.infoSections.length }],
          activityEvents: result.activityEvent ? [result.activityEvent, ...e.activityEvents] : e.activityEvents,
        }));
        setAddingSection(false);
        setSectionDraft({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
      }
    });
  };

  const deleteSection = (id: string) => {
    const section = event.infoSections.find((s) => s.id === id);
    if (!section) return;
    // Optimistically hide; commit to DB after 5s unless undone
    setEvent((e) => ({ ...e, infoSections: e.infoSections.filter((s) => s.id !== id) }));
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      startTransition(() => removeInfoSection(pendingDelete.id).then(() => {}));
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await removeInfoSection(id);
        if (result?.activityEvent) {
          setEvent((e) => ({ ...e, activityEvents: [result.activityEvent!, ...e.activityEvents] }));
        }
      });
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, section, timer });
  };

  const undoDeleteSection = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timer);
    setEvent((e) => ({
      ...e,
      infoSections: [...e.infoSections, pendingDelete.section].sort((a, b) => a.order - b.order),
    }));
    setPendingDelete(null);
  };

  const startEditSection = (sec: EventData["infoSections"][number]) => {
    setEditingSection(sec.id);
    setEditDraft({ iconKey: resolveIconKey(sec.type), content: sec.content, url: sec.url ?? "", title: sec.title ?? "" });
  };

  const commitEditSection = async (id: string) => {
    if (!editDraft.content.trim() && !editDraft.url.trim()) return;
    startTransition(async () => {
      await updateInfoSection(id, {
        type: editDraft.iconKey,
        title: editDraft.title.trim() || null,
        content: editDraft.content,
        url: editDraft.url || null,
      });
      setEvent((e) => ({
        ...e,
        infoSections: e.infoSections.map((s) =>
          s.id === id
            ? { ...s, type: editDraft.iconKey, title: editDraft.title.trim() || null, content: editDraft.content, url: editDraft.url || null }
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
      const result = await addPotluckItem(event.id, newPotluckLabel.trim(), newPotluckQty);
      if (result.success) {
        setEvent((e) => ({
          ...e,
          potluckItems: [...e.potluckItems, { id: result.id!, label: newPotluckLabel.trim(), quantity: newPotluckQty, claimedQty: null, claimedBy: null, claimedAt: null }],
        }));
        setNewPotluckLabel("");
        setNewPotluckQty(1);
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
    const result = await claimPotluckItem(itemId, name, claimQty);
    if (result.success) {
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) => i.id === itemId ? { ...i, claimedBy: name, claimedAt: new Date(), claimedQty: claimQty } : i),
        activityEvents: result.activityEvent ? [result.activityEvent, ...e.activityEvents] : e.activityEvents,
      }));
      setClaimingItemId(null);
      setClaimName("");
      setClaimQty(1);
    }
  };

  const unclaimItem = async (itemId: string, name: string) => {
    const result = await unclaimPotluckItem(itemId, name);
    if (result.success) {
      setEvent((e) => ({
        ...e,
        potluckItems: e.potluckItems.map((i) => i.id === itemId ? { ...i, claimedBy: null, claimedAt: null, claimedQty: null } : i),
        activityEvents: result.activityEvent ? [result.activityEvent, ...e.activityEvents] : e.activityEvents,
      }));
    }
  };

  const removeActivityEvent = (id: string) => {
    setEvent((e) => ({ ...e, activityEvents: e.activityEvents.filter((a) => a.id !== id) }));
    deleteActivityEvent(id).catch(() => {});
  };

  const handleApprove = (rsvpId: string, message?: string) => {
    startTransition(async () => {
      const result = await approveRsvp(rsvpId, message);
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

  const handleDecline = (rsvpId: string, message?: string) => {
    startTransition(async () => {
      const result = await declineRsvp(rsvpId, message);
      if (result.success) {
        setEvent((e) => ({ ...e, pendingRsvps: e.pendingRsvps.filter((r) => r.id !== rsvpId) }));
      }
    });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, position: "relative" as const, overflowX: "hidden" as const, fontFamily: "inherit" },
    container: { position: "relative" as const, zIndex: 1, maxWidth: "440px", margin: "0 auto", padding: "96px 16px 160px" },
    card: { background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "24px", marginBottom: "16px", backdropFilter: "blur(12px)", boxShadow: t.cardShadow },
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

  const navUserInitial = sessionUser?.email?.[0]?.toUpperCase() ?? null;

  return (
    <div style={S.page}>
      <style>{`
        .chip-button {
          transition: all 0.2s ease !important;
        }
        .chip-button:hover {
          opacity: 0.85 !important;
          transform: scale(1.03) !important;
        }
        .chip-button:active {
          transform: scale(0.97) !important;
        }
      `}</style>
      {/* ── Top nav ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>🎉</span>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>RSVP</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isHost && (
            <a
              href={`/e/${event.slug}/settings`}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "6px 8px", color: "#fff", display: "flex", alignItems: "center", textDecoration: "none" }}
              title="Event settings"
            >
              <Settings size={15} />
            </a>
          )}
          {navUserInitial && (
            <a
              href="/dashboard"
              title="Go to dashboard"
              style={{ width: "32px", height: "32px", borderRadius: "50%", background: t.avatarGradient, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", color: "#fff", textDecoration: "none", flexShrink: 0 }}
            >
              {navUserInitial}
            </a>
          )}
        </div>
      </nav>

      {/* Background decorations */}
      {t.pageDecoration === "dark-orbs" && (
        <>
          <div style={{ position: "fixed", top: "-20%", left: "30%", width: "600px", height: "600px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "10%", right: "-10%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "soft-blobs" && (
        <>
          <div style={{ position: "fixed", top: "-10%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: t.pageDecorationBg1, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "fixed", bottom: "20%", left: "-5%", width: "400px", height: "400px", borderRadius: "50%", background: t.pageDecorationBg2, filter: "blur(60px)", pointerEvents: "none", zIndex: 0 }} />
        </>
      )}
      {t.pageDecoration === "bold-hero" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: t.pageDecorationBg1, zIndex: 0 }} />
      )}

      <div style={S.container}>

        {/* ── Title ── */}
        <h1 style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "8px", fontFamily: t.headingFont, color: t.textPrimary }}>
          <InlineEdit value={event.title} onSave={(v) => save("title", v)} placeholder="Event title" style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: t.headingFont }} isHost={isHost} />
        </h1>

        {/* ── Host byline ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", color: t.textSecondary, fontSize: "14px" }}>
          <div style={{ ...S.avatar, background: t.avatarGradient }}>{event.host.name?.[0] ?? event.host.email[0].toUpperCase()}</div>
          Hosted by {event.host.name ?? event.host.email}
        </div>

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
          baseTheme={event.theme?.baseTheme ?? "DARK"}
        />

        {/* ── Description ── */}
        <div style={{ ...S.card, marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, marginBottom: "8px" }}>Details</div>
          <InlineEdit value={event.description ?? ""} onSave={(v) => save("description", v)} placeholder="Add a description…" multiline style={{ color: t.textSecondary, lineHeight: "1.7", fontSize: "16px", whiteSpace: "pre-wrap", display: "block" }} isHost={isHost} />
        </div>

        {/* ── Info sections ── */}
        {event.infoSections.length > 0 && (
          <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, backdropFilter: "blur(12px)", marginBottom: "16px", overflow: "hidden" }}>
            {event.infoSections.map((sec, i) => {
              const item = getIconItem(sec.type);
              const Icon = item.icon;
              const isEditing = editingSection === sec.id;
              return (
                <div key={sec.id} style={{ borderTop: i > 0 ? `1px solid ${t.cardBorder}` : "none" }}>
                  {isEditing ? (
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <IconPicker selected={editDraft.iconKey} onSelect={(key) => setEditDraft((d) => ({ ...d, iconKey: key }))} t={t} />
                      <textarea
                        style={{ ...S.inp, resize: "none" } as React.CSSProperties}
                        rows={2}
                        placeholder={getPlaceholder(editDraft.iconKey)}
                        value={editDraft.content}
                        onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                        autoFocus
                      />
                      {(editDraft.iconKey === "zelle" || editDraft.iconKey === "venmo") && (
                        <input
                          style={S.inp}
                          type="text"
                          placeholder="Suggested donation amount (optional, e.g. 15)"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                        />
                      )}
                      <input
                        style={S.inp}
                        type="url"
                        placeholder="Link (optional)"
                        value={editDraft.url}
                        onChange={(e) => setEditDraft((d) => ({ ...d, url: e.target.value }))}
                      />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => commitEditSection(sec.id)} style={{ ...S.btn, flex: 1, padding: "8px" }}>Save</button>
                        <button onClick={() => setEditingSection(null)} style={S.mutedBtn}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "11px 16px" }}>
                      <Icon size={15} style={{ color: t.accent, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: "13px" }}>
                        {sec.url ? (
                          <a href={sec.url} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: "none" }}>
                            {sec.content || sec.url} <ExternalLink size={11} style={{ display: "inline", verticalAlign: "middle" }} />
                          </a>
                        ) : (
                          <span style={{ color: t.textSecondary }}>{sec.content}</span>
                        )}
                        {sec.title && (sec.type === "zelle" || sec.type === "venmo") && (
                          <span style={{ marginLeft: "6px", color: t.textMuted, fontSize: "12px" }}>
                            (Suggested: ${sec.title})
                          </span>
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

        {/* ── Undo delete toast ── */}
        {pendingDelete && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius, padding: "12px 16px", marginBottom: "8px", gap: "12px" }}>
            <span style={{ fontSize: "13px", color: t.textSecondary }}>Section removed</span>
            <button onClick={undoDeleteSection} style={{ background: "none", border: `1px solid ${t.cardBorder}`, borderRadius: t.btnRadius, padding: "4px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: t.accent, fontFamily: "inherit" }}>
              Undo
            </button>
          </div>
        )}

        {/* ── Add info section (host only) ── */}
        {isHost && (
          addingSection ? (
            <div style={{ ...S.card, marginBottom: "24px" }}>
              <IconPicker selected={sectionDraft.iconKey} onSelect={(key) => setSectionDraft((d) => ({ ...d, iconKey: key }))} t={t} />
              <textarea
                style={{ ...S.inp, resize: "none", marginBottom: "10px" } as React.CSSProperties}
                rows={2}
                placeholder={getPlaceholder(sectionDraft.iconKey)}
                value={sectionDraft.content}
                onChange={(e) => setSectionDraft((d) => ({ ...d, content: e.target.value }))}
                autoFocus
              />
              {(sectionDraft.iconKey === "zelle" || sectionDraft.iconKey === "venmo") && (
                <input
                  style={{ ...S.inp, marginBottom: "10px" }}
                  type="text"
                  placeholder="Suggested donation amount (optional, e.g. 15)"
                  value={sectionDraft.title}
                  onChange={(e) => setSectionDraft((d) => ({ ...d, title: e.target.value }))}
                />
              )}
              <input
                style={{ ...S.inp, marginBottom: "10px" }}
                type="url"
                placeholder="Link (optional)"
                value={sectionDraft.url}
                onChange={(e) => setSectionDraft((d) => ({ ...d, url: e.target.value }))}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={commitInfoSection} style={{ ...S.btn, flex: 1, padding: "10px" }}>Save</button>
                <button onClick={() => setAddingSection(false)} style={S.mutedBtn}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
              {PRESET_CHIPS.filter((p) => !event.infoSections.some((s) => s.type === p.key)).map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.key}
                    className="chip-button"
                    onClick={() => {
                      setAddingSection(true);
                      setSectionDraft({ iconKey: preset.key, content: "", url: "", title: "" });
                    }}
                    style={getChipStyle(false)}
                  >
                    <Icon size={13} />
                    {preset.label}
                  </button>
                );
              })}
              <button
                className="chip-button"
                onClick={() => {
                  setAddingSection(true);
                  setSectionDraft({ iconKey: ICON_SET[0].key, content: "", url: "", title: "" });
                }}
                style={getChipStyle(true)}
              >
                <Plus size={13} />
                Add Custom
              </button>
            </div>
          )
        )}


        {/* ── Potluck ── */}
        {(isHost || rsvpStatus === "GOING") && (event.potluckItems.length > 0 || isHost) && (
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
                      <span style={{ fontSize: "14px", fontWeight: 600, color: t.textPrimary }}>
                        {item.label}
                        {item.quantity > 1 && ` (need ${item.quantity})`}
                      </span>
                      {item.claimedBy && (
                        <span style={{ fontSize: "12px", color: t.textMuted, marginLeft: "8px" }}>
                          ✓ {item.claimedBy}
                          {item.claimedQty && ` (bringing ${item.claimedQty})`}
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
                    {item.claimedBy && (isHost || item.claimedBy === guestName) && (
                      <button
                        onClick={() => unclaimItem(item.id, item.claimedBy!)}
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
                      <input
                        type="number"
                        min="1"
                        style={{ ...S.inp, width: "70px", textAlign: "center" }}
                        value={claimQty}
                        onChange={(e) => setClaimQty(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="Qty"
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
                <input
                  type="number"
                  min="1"
                  style={{ ...S.inp, width: "70px", textAlign: "center" }}
                  value={newPotluckQty}
                  onChange={(e) => setNewPotluckQty(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder="Qty"
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
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>
                  {rsvpStatus === "GOING" ? "🎉" : rsvpStatus === "MAYBE" ? "🤔" : "😔"}
                </div>
                <div style={{ fontWeight: 700, marginBottom: "12px" }}>
                  {rsvpStatus === "GOING" ? "You're going!" : rsvpStatus === "MAYBE" ? "Marked as maybe" : "Can't make it"}
                </div>
                {guestEditToken && (
                  <a
                    href={`/e/${event.slug}/rsvp?token=${guestEditToken}`}
                    style={{ fontSize: "13px", color: t.accent, textDecoration: "none", fontWeight: 600 }}
                  >
                    Edit my RSVP →
                  </a>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                {(["GOING", "MAYBE", "NO"] as const).filter((s) => s !== "MAYBE" || event.maybeEnabled).map((s) => (
                  <a
                    key={s}
                    href={`/e/${event.slug}/rsvp?status=${s}`}
                    style={{
                      flex: 1, padding: "14px 8px", border: `1px solid ${t.inputBorder}`, borderRadius: t.btnRadius,
                      fontFamily: "inherit", fontSize: "12px", fontWeight: 700, background: t.inputBg,
                      color: t.textSecondary, textDecoration: "none", display: "flex", flexDirection: "column",
                      alignItems: "center", gap: "5px", cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>{s === "GOING" ? "🎉" : s === "MAYBE" ? "🤔" : "😔"}</span>
                    {s === "GOING" ? "Going" : s === "MAYBE" ? "Maybe" : "Can't go"}
                  </a>
                ))}
              </div>
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
                    onClick={() => setActiveApproval({ rsvpId: r.id, type: "APPROVE", guestName: r.guestName })}
                    disabled={isPending}
                    style={{ background: t.accent, color: t.accentFg, border: "none", borderRadius: "8px", padding: "6px 14px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
                    title="Approve"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setActiveApproval({ rsvpId: r.id, type: "DECLINE", guestName: r.guestName })}
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

        {/* ── Guest Sharing Card ── */}
        {!isHost && event.guestSharingEnabled && event.visibility !== "PRIVATE" && (
          <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "16px" }}>📢</span>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>Share this event</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined") {
                    navigator.clipboard.writeText(window.location.origin + `/e/${event.slug}`);
                    alert("Event link copied!");
                  }
                }}
                style={{
                  flex: 1, padding: "10px 14px", background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                  borderRadius: t.btnRadius, color: t.textPrimary, fontFamily: "inherit", fontSize: "13px",
                  fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                }}
              >
                <span>📋</span> Copy Link
              </button>
              <button
                onClick={() => setShowShareQr(true)}
                style={{
                  flex: 1, padding: "10px 14px", background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                  borderRadius: t.btnRadius, color: t.textPrimary, fontFamily: "inherit", fontSize: "13px",
                  fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                }}
              >
                <span>📱</span> Show QR Code
              </button>
            </div>
          </div>
        )}

        {/* ── Guest List ── */}
        {(event.guestListVis === "ALL" || isHost) && event.rsvps.length > 0 && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={16} style={{ color: t.accent }} />
                <span style={{ fontWeight: 700 }}>Guests ({event.rsvps.length})</span>
              </div>
              <a href={`/e/${event.slug}/guests`} style={{ fontSize: "13px", color: t.accent, textDecoration: "none", opacity: 0.85 }}>
                View all →
              </a>
            </div>
            {going.length > 0 && (
              <div style={{ marginBottom: (maybe.length > 0 || no.length > 0) ? "14px" : 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, marginBottom: "8px" }}>Going · {totalGoing}</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
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
            {maybe.length > 0 && (
              <div style={{ marginBottom: no.length > 0 ? "14px" : 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, marginBottom: "8px" }}>Maybe · {maybe.length}</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                  {maybe.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "14px", background: t.pillBg, border: `1px solid ${t.pillBorder}`, fontSize: "13px", opacity: 0.75 }}>
                      <div style={{ ...S.avatar, width: "20px", height: "20px", fontSize: "10px", minWidth: "20px" }}>{r.guestName[0].toUpperCase()}</div>
                      <span>{r.guestName}{r.plusOneCount > 0 && ` +${r.plusOneCount}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {no.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: t.textMuted, marginBottom: "8px" }}>Can&apos;t make it · {no.length}</div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px" }}>
                  {no.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "14px", background: t.pillBg, border: `1px solid ${t.pillBorder}`, fontSize: "13px", opacity: 0.45 }}>
                      <div style={{ ...S.avatar, width: "20px", height: "20px", fontSize: "10px", minWidth: "20px" }}>{r.guestName[0].toUpperCase()}</div>
                      <span>{r.guestName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Activity (updates + comments unified) ── */}
        {(event.commentsEnabled || event.updates.length > 0 || isHost) && (
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
              <MessageSquare size={16} style={{ color: t.accent }} />
              <span style={{ fontWeight: 700 }}>Activity</span>
            </div>

            {/* Compose area — top of card */}
            {isHost && (
              <div style={{ background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: "12px", padding: "12px", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", color: t.accent, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "8px" }}>Post an Update</div>
                <textarea
                  style={{ ...S.inp, resize: "none", marginBottom: "8px" } as React.CSSProperties}
                  rows={3}
                  placeholder="Changed start time, new location, what to bring…"
                  value={updateDraft}
                  onChange={(e) => setUpdateDraft(e.target.value)}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: t.textSecondary, cursor: "pointer" }}>
                    <input type="checkbox" checked={notifyOnUpdate} onChange={(e) => setNotifyOnUpdate(e.target.checked)} style={{ accentColor: t.accent }} />
                    Notify guests via email
                  </label>
                  <button
                    onClick={postUpdate}
                    disabled={!updateDraft.trim() || isPostingUpdate}
                    style={{ ...S.btn, width: "auto", padding: "8px 18px", opacity: !updateDraft.trim() || isPostingUpdate ? 0.5 : 1 }}
                  >
                    {isPostingUpdate ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            )}
            {event.commentsEnabled && guestRsvpId && !isHost && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "6px" }}>
                  Commenting as <strong style={{ color: t.textSecondary }}>{guestName}</strong>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    style={{ ...S.inp, flex: 1 }}
                    placeholder="Leave a comment…"
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

            {(() => {
              type FeedItem =
                | { kind: "update"; id: string; body: string; createdAt: Date }
                | { kind: "comment"; id: string; guestName: string; body: string; createdAt: Date; replies: { id: string; guestName: string; body: string; createdAt: Date }[] }
                | { kind: "activity"; id: string; type: string; actorName: string | null; detail: string; createdAt: Date };
              const feed: FeedItem[] = [
                ...event.updates.map((u) => ({ kind: "update" as const, id: u.id, body: u.body, createdAt: new Date(u.createdAt) })),
                ...(event.commentsEnabled ? event.comments.map((c) => ({ kind: "comment" as const, id: c.id, guestName: c.guestName, body: c.body, createdAt: new Date(c.createdAt), replies: c.replies.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })) })) : []),
                ...event.activityEvents.map((a) => ({ kind: "activity" as const, id: a.id, type: a.type, actorName: a.actorName, detail: a.detail, createdAt: new Date(a.createdAt) })),
              ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {feed.length === 0 ? (
                    <p style={{ color: t.textMuted, fontSize: "14px", textAlign: "center", padding: "12px 0" }}>No activity yet — be the first!</p>
                  ) : feed.map((item) => {
                    if (item.kind === "update") return (
                      <div key={`u-${item.id}`} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <div style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>📣</div>
                        <div style={{ flex: 1, minWidth: 0, background: t.accentBg, border: `1px solid ${t.accentBorder}`, borderRadius: "14px", padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700, fontSize: "13px", color: t.accent }}>Update from {event.host.name ?? event.host.email}</span>
                            {isHost && (
                              <button onClick={() => removeUpdate(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0 }}>
                                <X size={13} />
                              </button>
                            )}
                          </div>
                          {event.showTimestamps && <span style={{ color: t.textMuted, fontSize: "11px" }}>{timeAgo(item.createdAt)}</span>}
                          <p style={{ color: t.textSecondary, fontSize: "14px", margin: "4px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.body}</p>
                        </div>
                      </div>
                    );
                    if (item.kind === "activity") {
                      const iconEl = (() => {
                        if (item.type === "rsvp_new" || item.type === "rsvp_update") return <Users size={14} style={{ color: t.accent }} />;
                        if (item.type === "event_date") return <Calendar size={14} style={{ color: t.accent }} />;
                        if (item.type === "info_add") return <Plus size={14} style={{ color: t.accent }} />;
                        if (item.type === "info_delete") return <X size={14} style={{ color: t.textMuted }} />;
                        if (item.type === "potluck_claim") return <Gift size={14} style={{ color: t.accent }} />;
                        if (item.type === "potluck_unclaim") return <Gift size={14} style={{ color: t.textMuted }} />;
                        return <Pencil size={14} style={{ color: t.accent }} />;
                      })();
                      const [mainDetail, ...commentLines] = item.detail.split("\n");
                      const rsvpComment = commentLines.join("\n").trim();
                      return (
                        <div key={`a-${item.id}`} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "6px 0" }}>
                          <div style={{
                            width: "28px", height: "28px", borderRadius: "50%",
                            background: (item.type.startsWith("rsvp") || item.type === "potluck_claim") ? t.accentBg : t.pillBg,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: rsvpComment ? "2px" : 0,
                          }}>
                            {iconEl}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div>
                              <span style={{ fontSize: "13px", color: t.textSecondary }}>{mainDetail}</span>
                              {event.showTimestamps && (
                                <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "8px" }}>{timeAgo(item.createdAt)}</span>
                              )}
                            </div>
                            {rsvpComment && (
                              <div style={{ marginTop: "6px", borderLeft: `3px solid ${t.cardBorder}`, paddingLeft: "10px", color: t.textMuted, fontSize: "13px", fontStyle: "italic", lineHeight: 1.5 }}>
                                {rsvpComment}
                              </div>
                            )}
                          </div>
                          {isHost && (
                            <button
                              onClick={() => removeActivityEvent(item.id)}
                              title="Hide from activity"
                              style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px", flexShrink: 0, opacity: 0.6 }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={`c-${item.id}`} style={{ display: "flex", gap: "10px" }}>
                        <div style={{ ...S.avatar }}>{item.guestName[0].toUpperCase()}</div>
                        <div style={{ flex: 1, background: t.inputBg, borderRadius: "14px", padding: "10px 14px" }}>
                          <span style={{ fontWeight: 700, fontSize: "13px" }}>{item.guestName}</span>
                          {event.showTimestamps && <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "8px" }}>{timeAgo(item.createdAt)}</span>}
                          <p style={{ color: t.textSecondary, fontSize: "14px", margin: "4px 0 0" }}>{item.body}</p>
                          {item.replies.length > 0 && (
                            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              {item.replies.map((r) => (
                                <div key={r.id} style={{ display: "flex", gap: "8px" }}>
                                  <div style={{ ...S.avatar, width: "20px", height: "20px", fontSize: "10px", minWidth: "20px" }}>{r.guestName[0].toUpperCase()}</div>
                                  <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "6px 10px" }}>
                                    <span style={{ fontWeight: 700, fontSize: "12px" }}>{r.guestName}</span>
                                    {event.showTimestamps && <span style={{ color: t.textMuted, fontSize: "11px", marginLeft: "6px" }}>{timeAgo(r.createdAt)}</span>}
                                    <p style={{ fontSize: "13px", margin: "2px 0 0", color: t.textSecondary }}>{r.body}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: "32px", fontSize: "12px", color: t.textMuted, opacity: 0.5 }}>rsvp to me</p>
      </div>

      {/* ── Host Bar ── */}
      {isHost && <HostBar eventId={event.id} eventSlug={event.slug} theme={t} visibility={event.visibility} />}

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

      {/* ── Share QR Modal ── */}
      {showShareQr && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius,
            padding: "24px", width: "100%", maxWidth: "320px", backdropFilter: "blur(20px)",
            textAlign: "center", boxShadow: t.cardShadow || "0 10px 40px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: t.textPrimary, margin: "0 0 16px" }}>Event QR Code</h3>
            <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", display: "inline-block", marginBottom: "16px" }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin + `/e/${event.slug}` : "")}`}
                alt="Event QR Code"
                width={200}
                height={200}
                style={{ display: "block" }}
              />
            </div>
            <button
              onClick={() => setShowShareQr(false)}
              style={{
                width: "100%", padding: "12px", background: t.accent, color: t.accentFg, border: "none",
                borderRadius: t.btnRadius, cursor: "pointer", fontFamily: "inherit", fontWeight: 700
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Approval Message Modal ── */}
      {activeApproval && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
          <div style={{
            background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: t.cardRadius,
            padding: "24px", width: "100%", maxWidth: "400px", backdropFilter: "blur(20px)",
            boxShadow: t.cardShadow || "0 10px 40px rgba(0,0,0,0.3)"
          }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: t.textPrimary, margin: "0 0 8px" }}>
              {activeApproval.type === "APPROVE" ? "Approve RSVP" : "Decline RSVP"}
            </h3>
            <p style={{ fontSize: "14px", color: t.textSecondary, margin: "0 0 16px" }}>
              {activeApproval.type === "APPROVE"
                ? `Would you like to send a message to ${activeApproval.guestName}?`
                : `Would you like to send a message to ${activeApproval.guestName} explaining why?`}
            </p>
            <textarea
              style={{ ...S.inp, resize: "none", marginBottom: "20px" } as React.CSSProperties}
              rows={3}
              placeholder="Type an optional message..."
              value={approvalMessage}
              onChange={(e) => setApprovalMessage(e.target.value)}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveApproval(null); setApprovalMessage(""); }}
                style={{
                  padding: "10px 18px", background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                  borderRadius: t.btnRadius, color: t.textSecondary, cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const rsvpId = activeApproval.rsvpId;
                  const type = activeApproval.type;
                  const msg = approvalMessage.trim() || undefined;
                  setActiveApproval(null);
                  setApprovalMessage("");
                  if (type === "APPROVE") {
                    handleApprove(rsvpId, msg);
                  } else {
                    handleDecline(rsvpId, msg);
                  }
                }}
                style={{
                  padding: "10px 18px", background: activeApproval.type === "APPROVE" ? t.accent : "#ef4444",
                  border: "none", borderRadius: t.btnRadius, color: activeApproval.type === "APPROVE" ? t.accentFg : "#fff",
                  cursor: "pointer", fontFamily: "inherit", fontWeight: 700
                }}
              >
                {activeApproval.type === "APPROVE" ? "Approve" : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
