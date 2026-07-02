"use client";

import { APP_SHELL } from "@/lib/theme";
import type { AdminStats } from "./types";

export function OverviewTab({ initialStats }: { initialStats: AdminStats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[
          {
            label: "Total Users",
            val: initialStats.totalUsers,
            glow: "rgba(168, 85, 247, 0.4)",
            emoji: "👥",
          },
          {
            label: "Total Events",
            val: initialStats.totalEvents,
            glow: "rgba(236, 72, 153, 0.4)",
            emoji: "🎈",
          },
          {
            label: "Total RSVPs",
            val: initialStats.totalRsvps,
            glow: "rgba(16, 185, 129, 0.4)",
            emoji: "✓",
          },
          {
            label: "Guest Check-Ins",
            val: initialStats.totalCheckIns,
            glow: "rgba(14, 165, 233, 0.4)",
            emoji: "📍",
          },
        ].map((card, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: APP_SHELL.cardBg,
              border: `1px solid ${APP_SHELL.cardBorder}`,
              borderRadius: APP_SHELL.cardRadius,
              padding: "24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: "-20px",
                bottom: "-20px",
                fontSize: "80px",
                opacity: 0.05,
                userSelect: "none",
              }}
            >
              {card.emoji}
            </div>
            <div
              style={{
                color: APP_SHELL.textSecondary,
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                color: APP_SHELL.textPrimary,
                fontSize: "40px",
                fontWeight: 800,
                marginTop: "12px",
              }}
            >
              {card.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
