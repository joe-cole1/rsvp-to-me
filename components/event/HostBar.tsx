"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, Settings, Eye, Globe, Link2, Lock } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";
import { sendBlast, sendSmsBlast, saveEventSettings } from "@/app/actions/event";
import QRCode from "qrcode";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

const VISIBILITY_OPTIONS: { value: Visibility; icon: React.ElementType; label: string; description: string }[] = [
  { value: "PUBLIC",   icon: Globe, label: "Public",   description: "Anyone can find this event" },
  { value: "UNLISTED", icon: Link2, label: "Unlisted", description: "Only people with the link" },
  { value: "PRIVATE",  icon: Lock,  label: "Private",  description: "Invite only, approval required" },
];

function visibilityIcon(v: Visibility) {
  if (v === "PUBLIC")   return Globe;
  if (v === "PRIVATE")  return Lock;
  return Link2;
}

export function HostBar({
  eventId,
  eventSlug,
  theme: t,
  visibility: initialVisibility,
}: {
  eventId: string;
  eventSlug: string;
  theme: ResolvedTheme;
  visibility: Visibility;
}) {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [blastResult, setBlastResult] = useState<string | null>(null);
  const [smsResult, setSmsResult] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [visibilityPending, setVisibilityPending] = useState(false);

  const VisIcon = visibilityIcon(visibility);

  const actions = [
    { id: "invite",     icon: Mail,          label: "Invite",   href: null },
    { id: "message",    icon: MessageSquare, label: "Message",  href: null },
    { id: "visibility", icon: VisIcon,       label: visibility === "PUBLIC" ? "Public" : visibility === "UNLISTED" ? "Unlisted" : "Private", href: null },
    { id: "settings",   icon: Settings,      label: "Settings", href: `/e/${eventSlug}/settings` },
    { id: "preview",    icon: Eye,           label: "Preview",  href: null },
  ];

  const handleVisibilityChange = async (next: Visibility) => {
    if (next === visibility || visibilityPending) return;
    const prev = visibility;
    setVisibilityPending(true);
    setVisibility(next);
    try {
      await saveEventSettings(eventId, { visibility: next });
    } catch {
      setVisibility(prev);
    } finally {
      setVisibilityPending(false);
      setActivePanel(null);
    }
  };

  const handleBlast = async (filter: "ALL" | "GOING") => {
    if (!messageText.trim() || isSending) return;
    setIsSending(true);
    setBlastResult(null);
    try {
      const result = await sendBlast(eventId, messageText.trim(), filter);
      if (result.success) {
        setBlastResult(
          result.sent === 0
            ? "No guests with email addresses found."
            : `Sent to ${result.sent} guest${result.sent !== 1 ? "s" : ""}.`
        );
        setMessageText("");
      }
    } catch {
      setBlastResult("Failed to send. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating bar — hidden while a panel is open */}
      {!activePanel && <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15,15,20,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "100px",
          padding: "8px 16px",
          display: "flex",
          gap: "4px",
          zIndex: 100,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {actions.map(({ id, icon: Icon, label, href }) =>
          href ? (
            <a
              key={id}
              href={href}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                padding: "8px 14px", borderRadius: "80px", textDecoration: "none",
                color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 600,
                background: "transparent", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon size={18} />
              {label}
            </a>
          ) : (
            <button
              key={id}
              onClick={() => setActivePanel(activePanel === id ? null : id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                padding: "8px 14px", borderRadius: "80px", border: "none", cursor: "pointer",
                background: activePanel === id ? `rgba(${t.accent},0.2)` : "transparent",
                color: activePanel === id ? t.accent : "rgba(255,255,255,0.7)",
                fontSize: "11px", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s",
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        )}
      </div>}

      {/* Panels */}
      {activePanel === "invite" && (
        <SlideUp
          onClose={() => setActivePanel(null)}
          title="Invite Guests"
          onOpen={async () => {
            if (typeof window !== "undefined") {
              try {
                const url = await QRCode.toDataURL(window.location.href, { width: 220, margin: 1, color: { dark: "#000", light: "#fff" } });
                setQrDataUrl(url);
              } catch { /* no-op */ }
            }
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            Share the event link or send invites directly.
          </p>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", marginBottom: "12px", wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.href : ""}
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button
              onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(window.location.href); }}
              style={{ flex: 1, padding: "12px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "12px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
            >
              Copy Link
            </button>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download="event-qr.png"
                style={{ padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}
              >
                ↓ QR
              </a>
            )}
          </div>
          {qrDataUrl && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Event QR code" width={160} height={160} style={{ borderRadius: "12px" }} />
            </div>
          )}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "4px", textAlign: "center" }}>
            Email & SMS invites available in Settings
          </p>
        </SlideUp>
      )}

      {activePanel === "message" && (
        <SlideUp
          onClose={() => { setActivePanel(null); setBlastResult(null); setSmsResult(null); }}
          title="Message Guests"
        >
          <textarea
            rows={4}
            placeholder="Type your message…"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "12px 16px", color: "#fff", fontFamily: "inherit",
              fontSize: "14px", outline: "none", resize: "none", marginBottom: "10px", boxSizing: "border-box",
            }}
          />

          {/* Email blast */}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            📧 Email
          </p>
          {blastResult && (
            <p style={{ fontSize: "13px", marginBottom: "8px", padding: "8px 12px", borderRadius: "8px", background: blastResult.startsWith("Sent") ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: blastResult.startsWith("Sent") ? "#4ade80" : "#f87171" }}>
              {blastResult}
            </p>
          )}
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
            <button
              onClick={() => handleBlast("ALL")}
              disabled={!messageText.trim() || isSending}
              style={{ flex: 1, padding: "10px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: messageText.trim() && !isSending ? "pointer" : "not-allowed", opacity: !messageText.trim() || isSending ? 0.5 : 1 }}
            >
              {isSending ? "Sending…" : "All"}
            </button>
            <button
              onClick={() => handleBlast("GOING")}
              disabled={!messageText.trim() || isSending}
              style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: messageText.trim() && !isSending ? "pointer" : "not-allowed", opacity: !messageText.trim() || isSending ? 0.5 : 1 }}
            >
              Going Only
            </button>
          </div>

          {/* SMS blast */}
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            💬 SMS
          </p>
          {smsResult && (
            <p style={{ fontSize: "13px", marginBottom: "8px", padding: "8px 12px", borderRadius: "8px", background: smsResult.startsWith("Sent") ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: smsResult.startsWith("Sent") ? "#4ade80" : "#f87171" }}>
              {smsResult}
            </p>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={async () => {
                if (!messageText.trim() || isSending) return;
                setIsSending(true); setSmsResult(null);
                try {
                  const r = await sendSmsBlast(eventId, messageText.trim(), "ALL");
                  setSmsResult(r.sent === 0 ? "No guests with phone numbers found." : `Sent to ${r.sent} guest${r.sent !== 1 ? "s" : ""}.`);
                  setMessageText("");
                } catch { setSmsResult("Failed to send. Try again."); } finally { setIsSending(false); }
              }}
              disabled={!messageText.trim() || isSending}
              style={{ flex: 1, padding: "10px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: messageText.trim() && !isSending ? "pointer" : "not-allowed", opacity: !messageText.trim() || isSending ? 0.5 : 1 }}
            >
              {isSending ? "Sending…" : "All"}
            </button>
            <button
              onClick={async () => {
                if (!messageText.trim() || isSending) return;
                setIsSending(true); setSmsResult(null);
                try {
                  const r = await sendSmsBlast(eventId, messageText.trim(), "GOING");
                  setSmsResult(r.sent === 0 ? "No going guests with phone numbers found." : `Sent to ${r.sent} guest${r.sent !== 1 ? "s" : ""}.`);
                  setMessageText("");
                } catch { setSmsResult("Failed to send. Try again."); } finally { setIsSending(false); }
              }}
              disabled={!messageText.trim() || isSending}
              style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: messageText.trim() && !isSending ? "pointer" : "not-allowed", opacity: !messageText.trim() || isSending ? 0.5 : 1 }}
            >
              Going Only
            </button>
          </div>
        </SlideUp>
      )}

      {activePanel === "visibility" && (
        <SlideUp onClose={() => setActivePanel(null)} title="Event Visibility">
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            Control who can find and view this event.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, description }) => {
              const isActive = visibility === value;
              return (
                <button
                  key={value}
                  onClick={() => handleVisibilityChange(value)}
                  disabled={visibilityPending}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 16px", borderRadius: "14px", border: "none", cursor: visibilityPending ? "not-allowed" : "pointer",
                    background: isActive ? t.accentBg : "rgba(255,255,255,0.05)",
                    outline: isActive ? `1.5px solid ${t.accentBorder}` : "1.5px solid transparent",
                    textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
                    opacity: visibilityPending && !isActive ? 0.5 : 1,
                  }}
                >
                  <Icon size={20} color={isActive ? t.accent : "rgba(255,255,255,0.5)"} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: isActive ? "#fff" : "rgba(255,255,255,0.75)" }}>{label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{description}</div>
                  </div>
                  {isActive && (
                    <div style={{ marginLeft: "auto", width: "18px", height: "18px", borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke={t.accentFg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </SlideUp>
      )}

      {activePanel === "preview" && (
        <SlideUp onClose={() => setActivePanel(null)} title="Preview as Guest">
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            This shows you exactly what guests see when they open your event.
          </p>
          <button
            onClick={() => {
              window.open(window.location.href + "?preview=1", "_blank");
              setActivePanel(null);
            }}
            style={{ width: "100%", padding: "12px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "12px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
          >
            Open Guest Preview
          </button>
        </SlideUp>
      )}
    </>
  );
}

function SlideUp({ children, onClose, onOpen, title }: { children: React.ReactNode; onClose: () => void; onOpen?: () => void; title: string }) {
  // Call onOpen once when mounted
  const calledRef = React.useRef(false);
  React.useEffect(() => {
    if (!calledRef.current && onOpen) { calledRef.current = true; onOpen(); }
  }, [onOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90 }}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 95,
          background: "rgba(15,15,20,0.95)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px 24px 0 0",
          padding: "24px 20px 40px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "17px" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "20px", padding: "4px" }}>×</button>
        </div>
        {children}
      </div>
    </>
  );
}
