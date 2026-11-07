"use client";
import { useTranslations } from "next-intl";

import { APP_SHELL_THEME } from "@/lib/theme";
import { NavItem } from "@/components/ui/NavItem";
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
  const tr = useTranslations("Ui.Admin");

  return (
    <div className="hidden lg:flex lg:flex-col lg:w-[240px] shrink-0 lg:border-b-0 mb-4 lg:mb-0">
      {(
        [
          { id: "overview", label: tr("overview2") },
          { id: "users", label: tr("userManagement") },
          { id: "events", label: tr("eventModeration") },
          { id: "invites", label: tr("hostSettings") },
          { id: "email", label: tr("emailSettings") },
          { id: "sms", label: tr("smsSettings") },
          { id: "themes", label: tr("themePresets2") },
          { id: "backups", label: tr("databaseBackups") },
          { id: "docs", label: tr("documentation") },
        ] as const
      ).map((tab) => (
        <NavItem
          key={tab.id}
          theme={APP_SHELL_THEME}
          active={activeTab === tab.id}
          onClick={() => {
            handleTabChange(tab.id);
            setFeedback(null);
          }}
          style={{ whiteSpace: "nowrap" }}
        >
          {tab.label}
        </NavItem>
      ))}
    </div>
  );
}
