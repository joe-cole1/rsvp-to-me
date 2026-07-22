"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEffectsHidden, setEffectsHidden } from "@/lib/effect-visibility";
import { APP_SHELL } from "@/lib/theme";

export interface DropdownUser {
  name?: string | null;
  email?: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  avatarUrl?: string | null;
}

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  color: APP_SHELL.textPrimary,
  textDecoration: "none",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.2,
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  transition: "background 0.2s",
};

function MenuLink({
  href,
  children,
  onSelect,
}: {
  href: string;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <a
      href={href}
      role="menuitem"
      onClick={onSelect}
      style={menuItemStyle}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </a>
  );
}

function MenuButton({ children, onSelect }: { children: ReactNode; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      style={menuItemStyle}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

export default function ProfileDropdown({ user }: { user: DropdownUser | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const effectsHidden = useEffectsHidden();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();
  const closeMenu = () => setIsOpen(false);
  const toggleEffects = () => {
    setEffectsHidden(!effectsHidden);
    closeMenu();
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", zIndex: 100 }}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={user ? "Open profile menu" : "Open menu"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          width: "36px",
          height: "36px",
          padding: 0,
          border: "none",
          borderRadius: "50%",
          background: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          outline: "none",
          boxShadow: isOpen ? `0 0 10px ${APP_SHELL.accent}` : "none",
          transition: "box-shadow 0.2s ease",
        }}
      >
        {user?.avatarUrl ? (
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              overflow: "hidden",
              border: `2px solid ${isOpen ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
              position: "relative",
            }}
          >
            <Image
              src={user.avatarUrl}
              alt={displayName}
              fill
              sizes="36px"
              style={{ objectFit: "cover" }}
            />
          </span>
        ) : user ? (
          <span
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${APP_SHELL.accent}, ${APP_SHELL.accentSecondary})`,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "14px",
              border: `2px solid ${isOpen ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
            }}
          >
            {initials}
          </span>
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: `2px solid ${isOpen ? APP_SHELL.accent : APP_SHELL.cardBorder}`,
              background: "rgba(255,255,255,0.06)",
              color: APP_SHELL.textPrimary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={user ? "Profile menu" : "Viewer menu"}
          style={{
            position: "absolute",
            right: 0,
            top: "46px",
            width: "220px",
            padding: "8px",
            border: `1px solid ${APP_SHELL.cardBorder}`,
            borderRadius: "16px",
            backgroundColor: "rgba(18, 18, 28, 0.95)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {user ? (
            <>
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${APP_SHELL.navBorder}`,
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    color: APP_SHELL.textPrimary,
                    fontSize: "14px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    margin: "2px 0 6px",
                    color: APP_SHELL.textSecondary,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.email || "No email"}
                </div>
                {user.role !== "GUEST" && (
                  <span
                    style={{
                      padding: "2px 6px",
                      border: `1px solid ${
                        user.role === "ADMIN" ? "rgba(239, 68, 68, 0.3)" : "rgba(168, 85, 247, 0.3)"
                      }`,
                      borderRadius: "6px",
                      backgroundColor:
                        user.role === "ADMIN"
                          ? "rgba(239, 68, 68, 0.15)"
                          : "rgba(168, 85, 247, 0.15)",
                      color: user.role === "ADMIN" ? "#f87171" : APP_SHELL.accent,
                      fontSize: "9px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {user.role}
                  </span>
                )}
              </div>

              {user.role === "ADMIN" && (
                <MenuLink href="/admin" onSelect={closeMenu}>
                  🛡️ Admin Panel
                </MenuLink>
              )}
              <MenuLink href="/dashboard" onSelect={closeMenu}>
                🗓️ Event Dashboard
              </MenuLink>
              <MenuLink href="/profile" onSelect={closeMenu}>
                ⚙️ Profile Settings
              </MenuLink>
              {user.role !== "GUEST" && (
                <MenuLink href="/help" onSelect={closeMenu}>
                  📖 Help &amp; Guides
                </MenuLink>
              )}
            </>
          ) : (
            <MenuLink href="/auth/sign-in" onSelect={closeMenu}>
              🔑 Login
            </MenuLink>
          )}

          <MenuButton onSelect={toggleEffects}>
            ✨ {effectsHidden ? "Show effects" : "Hide effects"}
          </MenuButton>

          {user && (
            <>
              <div
                aria-hidden="true"
                style={{ height: "1px", backgroundColor: APP_SHELL.navBorder, margin: "6px 0" }}
              />
              <MenuLink href="/auth/sign-out" onSelect={closeMenu}>
                🚪 Sign Out
              </MenuLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}
