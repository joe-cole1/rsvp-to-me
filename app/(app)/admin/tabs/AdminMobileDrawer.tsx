"use client";
import { useTranslations } from "next-intl";

import { X } from "lucide-react";
import { APP_SHELL, APP_SHELL_THEME } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { NavItem } from "@/components/ui/NavItem";
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
  const tr = useTranslations("Ui.Admin");
  const common = useTranslations("Ui.Common");

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
            backgroundColor: APP_SHELL.chromeBackdrop,
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
              backgroundColor: APP_SHELL.chromeSurface,
              borderInlineEnd: `1px solid ${APP_SHELL.navBorder}`,
              padding: "24px 20px",
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
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: APP_SHELL_THEME.textPrimary }}>
                {tr("adminNavigation")}
              </h3>
              <Button
                theme={APP_SHELL_THEME}
                variant="icon"
                type="button"
                aria-label={common("close")}
                onClick={() => setIsDrawerOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </Button>
            </div>

            <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder }} />

            {/* The 4px padding (and matching negative margin) keeps the items' fills and
                focus rings clear of the scroll container's edge. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                overflowY: "auto",
                flex: 1,
                padding: "4px",
                margin: "-4px",
              }}
            >
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
                    setIsDrawerOpen(false);
                  }}
                >
                  {tab.label}
                </NavItem>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
