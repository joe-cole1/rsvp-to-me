"use client";

import { useState, useRef, useTransition } from "react";
import { Settings, Plus, MapPin, Video, Calendar, Users, MessageSquare, Send, X, Check, ExternalLink, Shirt, UtensilsCrossed, ParkingCircle, Link2, FileText } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { saveEventField, addRSVP, addComment, addInfoSection, removeInfoSection } from "@/app/actions/event";
import { HostBar } from "./HostBar";
import { ThemePicker } from "./ThemePicker";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  guestListVis: "ALL" | "GUESTS_ONLY" | "HOST_ONLY";
  host: { id: string; name: string | null; email: string };
  theme: { baseTheme: "DARK" | "SOFT" | "BOLD"; accentColor: string; coverImageUrl: string | null } | null;
  infoSections: { id: string; type: string; title: string | null; content: string; url: string | null; order: number }[];
  rsvps: { id: string; guestName: string; status: "GOING" | "MAYBE" | "NO"; plusOneCount: number; createdAt: Date }[];
  comments: { id: string; guestName: string; body: string; createdAt: Date; replies: { id: string; guestName: string; body: string; createdAt: Date }[] }[];
  rsvpFields: { id: string; label: string; fieldType: string; required: boolean; options: string | null }[];
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
  // Detect iOS/macOS via userAgent for Apple Maps; fallback to Google
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

// ── Main Component ─────────────────────────────────────────────────────────────

export function EventPage({ event: initial, isHost, theme }: { event: EventData; isHost: boolean; theme: ResolvedTheme }) {
  const [event, setEvent] = useState(initial);
  const [rsvpStatus, setRsvpStatus] = useState<"GOING" | "MAYBE" | "NO" | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [plusOne, setPlusOne] = useState(0);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState({ title: "", content: "", url: "" });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  const submitRSVP = async () => {
    if (!rsvpStatus || !guestName.trim()) return;
    startTransition(async () => {
      const result = await addRSVP({
        eventId: event.id,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || undefined,
        status: rsvpStatus,
        plusOneCount: plusOne,
      });
      if (result.success) {
        setRsvpDone(true);
        setEvent((e) => ({
          ...e,
          rsvps: [...e.rsvps, { id: result.id!, guestName: guestName.trim(), status: rsvpStatus, plusOneCount: plusOne, createdAt: new Date() }],
        }));
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

  // ── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: { minHeight: "100vh", background: t.pageBg, color: t.textPrimary, position: "relative" as const, overflowX: "hidden" as const, fontFamily: "inherit" },
    container: { position: "relative" as const, zIndex: 1, maxWidth: "440px", margin: "0 auto", padding: "48px 16px 120px" },
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
          style={{ ...coverStyle, width: "100%", height: "260px", borderRadius: t.pageDecoration === "bold-hero" ? "20px" : "20px", marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: t.pageDecoration === "dark-orbs" ? `0 0 60px ${t.accentBg}` : t.pageDecoration === "soft-blobs" ? "0 20px 60px rgba(0,0,0,0.08)" : "none" }}
        >
          {!event.theme?.coverImageUrl && <span style={{ fontSize: "72px" }}>🎉</span>}
          {isHost && (
            <button
              onClick={() => setShowThemePicker(true)}
              style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "none", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", color: "#fff", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
            >
              🎨 Theme
            </button>
          )}
        </div>

        {/* ── Date badges ── */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
          <span style={S.badge}>{formatDate(event.startAt, event.timezone)}</span>
          <span style={S.badge}>{formatTime(event.startAt, event.timezone)}</span>
        </div>

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
        {(event.locationType === "PHYSICAL" && (event.locationName || event.locationAddress)) && (
          <a
            href={event.locationAddress ? buildMapUrl(event.locationAddress) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "16px", borderRadius: t.cardRadius, background: t.cardBg, border: `1px solid ${t.cardBorder}`, backdropFilter: "blur(12px)", marginBottom: "24px", textDecoration: "none", color: "inherit" }}
          >
            <MapPin size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "15px" }}>{event.locationName}</div>
              {event.locationAddress && <div style={{ color: t.textMuted, fontSize: "13px", marginTop: "2px" }}>{event.locationAddress}</div>}
            </div>
          </a>
        )}
        {event.locationType === "VIRTUAL" && event.virtualUrl && (
          <a
            href={event.virtualUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px", borderRadius: t.cardRadius, background: t.cardBg, border: `1px solid ${t.cardBorder}`, marginBottom: "24px", textDecoration: "none", color: "inherit" }}
          >
            <Video size={18} style={{ color: t.accent }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "15px" }}>Virtual Event</div>
              <div style={{ color: t.textMuted, fontSize: "13px" }}>Click to join</div>
            </div>
            <ExternalLink size={14} style={{ marginLeft: "auto", color: t.textMuted }} />
          </a>
        )}

        {/* ── Description ── */}
        <div style={{ ...S.card, background: "transparent", border: "none", padding: 0, marginBottom: "24px", backdropFilter: "none" }}>
          <p style={{ color: t.textSecondary, lineHeight: 1.7, fontSize: "15px", whiteSpace: "pre-wrap", fontFamily: t.headingFont === "inherit" ? "inherit" : "inherit" }}>
            <InlineEdit value={event.description ?? ""} onSave={(v) => save("description", v)} placeholder="Add a description…" multiline style={{ color: t.textSecondary, lineHeight: "1.7", fontSize: "15px", whiteSpace: "pre-wrap", display: "block" }} isHost={isHost} />
          </p>
        </div>

        {/* ── Info sections ── */}
        {event.infoSections.map((sec) => {
          const meta = INFO_META[sec.type] ?? INFO_META.CUSTOM;
          const Icon = meta.icon;
          return (
            <div key={sec.id} style={{ ...S.card, display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <Icon size={18} style={{ color: t.accent, flexShrink: 0, marginTop: "2px" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em", color: t.textMuted, marginBottom: "4px" }}>
                  {sec.title ?? meta.label}
                </div>
                <div style={{ fontSize: "14px", color: t.textSecondary }}>
                  {sec.type === "LINK" && sec.url ? (
                    <a href={sec.url} target="_blank" rel="noopener noreferrer" style={{ color: t.accent, textDecoration: "none" }}>
                      {sec.content} <ExternalLink size={12} style={{ display: "inline" }} />
                    </a>
                  ) : sec.content}
                </div>
              </div>
              {isHost && (
                <button onClick={() => deleteSection(sec.id)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: "2px" }}>
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}

        {/* ── Add info section chips (host only) ── */}
        {isHost && availableTypes.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
            {availableTypes.map((type) => {
              const meta = INFO_META[type];
              const Icon = meta.icon;
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
                  {guestEmail ? "A confirmation was sent to your email." : "Thanks for responding!"}
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
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "100px", background: t.pillBg, border: `1px solid ${t.pillBorder}`, fontSize: "13px" }}>
                  <div style={{ ...S.avatar, width: "20px", height: "20px", fontSize: "10px", minWidth: "20px" }}>{r.guestName[0].toUpperCase()}</div>
                  {r.guestName}{r.plusOneCount > 0 && ` +${r.plusOneCount}`}
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
      {isHost && <HostBar eventId={event.id} eventSlug={event.slug} theme={t} />}

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
          onSave={(base, accent) => {
            setShowThemePicker(false);
            // Reload to apply new theme
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
