"use client";

import { APP_SHELL } from "@/lib/theme";
import type { AdminFeedback, TabId } from "./types";

export function AdminSidebar({
  activeTab,
  handleTabChange,
  setFeedback,
}: {
  activeTab: TabId;
  handleTabChange: (id: TabId) => void;
  setFeedback: React.Dispatch<React.SetStateAction<AdminFeedback | null>>;
}) {
  return (
    <div className="hidden lg:flex lg:flex-col lg:w-[240px] shrink-0 lg:border-b-0 mb-4 lg:mb-0">
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
          }}
          style={{
            textAlign: "left",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "none",
            backgroundColor: activeTab === tab.id ? APP_SHELL.accent : "transparent",
            color: activeTab === tab.id ? "#fff" : APP_SHELL.textSecondary,
            fontSize: "14px",
            fontWeight: activeTab === tab.id ? 700 : 600,
            cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id)
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
