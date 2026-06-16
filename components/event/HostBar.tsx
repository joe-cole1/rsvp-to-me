"use client";

import { useState } from "react";
import { Mail, MessageSquare, Settings, Eye } from "lucide-react";
import type { ResolvedTheme } from "@/lib/theme";

export function HostBar({ eventSlug, theme: t }: { eventSlug: string; theme: ResolvedTheme }) {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const actions = [
    { id: "invite",   icon: Mail,          label: "Invite",   href: null },
    { id: "message",  icon: MessageSquare, label: "Message",  href: null },
    { id: "settings", icon: Settings,      label: "Settings", href: `/e/${eventSlug}/settings` },
    { id: "preview",  icon: Eye,           label: "Preview",  href: null },
  ];

  return (
    <>
      {/* Floating bar */}
      <div
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
      </div>

      {/* Panels */}
      {activePanel === "invite" && (
        <SlideUp onClose={() => setActivePanel(null)} title="Invite Guests">
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            Share the event link or send invites directly.
          </p>
          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", marginBottom: "12px", wordBreak: "break-all" }}>
            {typeof window !== "undefined" ? window.location.href : ""}
          </div>
          <button
            onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(window.location.href); }}
            style={{ width: "100%", padding: "12px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "12px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
          >
            Copy Link
          </button>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "12px", textAlign: "center" }}>
            Email & SMS invites available in Settings
          </p>
        </SlideUp>
      )}

      {activePanel === "message" && (
        <SlideUp onClose={() => setActivePanel(null)} title="Message Guests">
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "16px" }}>
            Send a message to all your guests, or just those who are going.
          </p>
          <textarea
            rows={4}
            placeholder="Type your message…"
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", color: "#fff", fontFamily: "inherit", fontSize: "14px", outline: "none", resize: "none", marginBottom: "10px" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{ flex: 1, padding: "12px", background: t.accent, color: t.accentFg, border: "none", borderRadius: "12px", fontFamily: "inherit", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              Send to All
            </button>
            <button style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontFamily: "inherit", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              Going Only
            </button>
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
              // TODO: open event in a new tab with ?preview=guest param
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

function SlideUp({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
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
