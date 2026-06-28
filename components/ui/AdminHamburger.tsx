"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";

const ADMIN_TABS = [
  { id: "overview", label: "📊 Overview" },
  { id: "users", label: "👥 User Management" },
  { id: "events", label: "🎈 Event Moderation" },
  { id: "invites", label: "🔑 Host Settings" },
  { id: "email", label: "📧 Email Settings" },
  { id: "sms", label: "💬 SMS Settings" },
  { id: "themes", label: "🎨 Theme Presets" },
  { id: "backups", label: "💾 Database Backups" },
  { id: "docs", label: "📚 Documentation" },
] as const;

export default function AdminHamburger() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "rgba(255,255,255,0.08)",
          border: `1px solid ${APP_SHELL.inputBorder}`,
          borderRadius: "8px",
          color: APP_SHELL.textPrimary,
          padding: "8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background-color 0.2s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")}
        title="Admin Menu"
      >
        <Menu size={20} />
      </button>

      {open &&
        createPortal(
          <>
            {/* Backdrop — portaled to body to escape nav stacking context */}
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(4px)",
                zIndex: 9998,
              }}
            />

            {/* Drawer — slides from the left */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
            @keyframes adminDrawerIn {
              from { transform: translateX(-100%); }
              to   { transform: translateX(0); }
            }
          `,
              }}
            />
            <div
              ref={drawerRef}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: "280px",
                backgroundColor: "#13091f",
                borderRight: "1px solid rgba(255,255,255,0.10)",
                padding: "24px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                zIndex: 9999,
                animation: "adminDrawerIn 0.25s cubic-bezier(0.16,1,0.3,1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 800, color: APP_SHELL.textPrimary }}>
                  🛡️ Admin Panel
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: APP_SHELL.textSecondary,
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

              <nav
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  overflowY: "auto",
                  flex: 1,
                }}
              >
                {ADMIN_TABS.map((tab) => (
                  <a
                    key={tab.id}
                    href={`/admin?tab=${tab.id}`}
                    onClick={() => setOpen(false)}
                    style={{
                      display: "block",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      color: APP_SHELL.textSecondary,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.color = APP_SHELL.textPrimary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = APP_SHELL.textSecondary;
                    }}
                  >
                    {tab.label}
                  </a>
                ))}
              </nav>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
