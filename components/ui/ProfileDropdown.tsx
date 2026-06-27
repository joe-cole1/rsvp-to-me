"use client";

import { useState, useRef, useEffect } from "react";
import { APP_SHELL } from "@/lib/theme";
import Image from "next/image";

interface DropdownUser {
  name?: string | null;
  email?: string | null;
  role: "GUEST" | "HOST" | "ADMIN";
  avatarUrl?: string | null;
}

export default function ProfileDropdown({ user }: { user: DropdownUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = user.name || user.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div ref={dropdownRef} style={{ position: "relative", zIndex: 100 }}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: "none",
          width: "36px",
          height: "36px",
          boxShadow: isOpen ? `0 0 10px ${APP_SHELL.accent}` : "none",
          transition: "box-shadow 0.2s ease",
        }}
      >
        {user.avatarUrl ? (
          <div
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
              unoptimized
              fill
              style={{
                objectFit: "cover",
              }}
            />
          </div>
        ) : (
          <div
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
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "46px",
            width: "220px",
            backgroundColor: "rgba(18, 18, 28, 0.95)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${APP_SHELL.cardBorder}`,
            borderRadius: "16px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Header Info */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${APP_SHELL.navBorder}`,
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "14px",
                color: APP_SHELL.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: APP_SHELL.textSecondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                margin: "2px 0 6px",
              }}
            >
              {user.email || "No email"}
            </div>
            {user.role !== "GUEST" && (
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  backgroundColor:
                    user.role === "ADMIN" ? "rgba(239, 68, 68, 0.15)" : "rgba(168, 85, 247, 0.15)",
                  color: user.role === "ADMIN" ? "#f87171" : APP_SHELL.accent,
                  padding: "2px 6px",
                  borderRadius: "6px",
                  border: `1px solid ${user.role === "ADMIN" ? "rgba(239, 68, 68, 0.3)" : "rgba(168, 85, 247, 0.3)"}`,
                }}
              >
                {user.role}
              </span>
            )}
          </div>

          {/* Links */}
          <a
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              color: APP_SHELL.textPrimary,
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            🗓️ Dashboard
          </a>

          <a
            href="/profile"
            onClick={() => setIsOpen(false)}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              color: APP_SHELL.textPrimary,
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            ⚙️ Profile Settings
          </a>

          {user.role !== "GUEST" && (
            <a
              href="/docs"
              onClick={() => setIsOpen(false)}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                color: APP_SHELL.textPrimary,
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              📚 Documentation
            </a>
          )}

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: APP_SHELL.navBorder, margin: "6px 0" }} />

          {/* Sign Out */}
          <a
            href="/auth/sign-out"
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              color: APP_SHELL.textMuted,
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = APP_SHELL.textMuted;
            }}
          >
            🚪 Sign Out
          </a>
        </div>
      )}
    </div>
  );
}
