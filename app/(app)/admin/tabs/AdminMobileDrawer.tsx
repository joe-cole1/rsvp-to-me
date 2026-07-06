"use client";

import { X } from "lucide-react";
import { APP_SHELL } from "@/lib/theme";
import type { AdminFeedback, TabId } from "./types";

export function AdminMobileDrawer({
  isDrawerOpen,
  setIsDrawerOpen,
  activeTab,
  handleTabChange,
  setFeedback,
}: {
  isDrawerOpen: boolean;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTab: TabId;
  handleTabChange: (id: TabId) => void;
  setFeedback: React.Dispatch<React.SetStateAction<AdminFeedback | null>>;
}) {
  return (
    <>
      {isDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            justifyContent: "flex-start",
          }}
          onClick={() => setIsDrawerOpen(false)}
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes slideIn {
                  from { transform: translateX(-100%); }
                  to { transform: translateX(0); }
                }
              `,
            }}
          />
          <div
            style={{
              width: "280px",
              height: "100%",
              backgroundColor: "#13091f",
              borderRight: "1px solid rgba(255, 255, 255, 0.10)",
              padding: "24px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: "relative",
              animation: "slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: APP_SHELL.textPrimary }}>
                🛡️ Admin Navigation
              </h3>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: APP_SHELL.textSecondary,
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {(
                [
                  { id: "overview", label: "📊 Overview" },
                  { id: "users", label: "👥 User Management" },
                  { id: "events", label: "🎈 Event Moderation" },
                  { id: "invites", label: "🔑 Host Settings" },
                  { id: "email", label: "📧 Email Settings" },
                  { id: "sms", label: "💬 SMS Settings" },
                  { id: "themes", label: "🎨 Theme Presets" },
                  { id: "backups", label: "💾 Database Backups" },
                  { id: "docs", label: "📚 Documentation" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    handleTabChange(tab.id);
                    setFeedback(null);
                    setIsDrawerOpen(false);
                  }}
                  style={{
                    textAlign: "left",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "none",
                    backgroundColor: activeTab === tab.id ? APP_SHELL.accent : "transparent",
                    color: activeTab === tab.id ? "#fff" : APP_SHELL.textSecondary,
                    fontSize: "14px",
                    fontWeight: activeTab === tab.id ? 700 : 600,
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id)
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
