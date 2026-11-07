"use client";

import type { ResolvedTheme } from "@/lib/theme";
import { EventCard } from "@/components/event/event-page/EventCard";

// Switches, labels, fields and buttons are the shared set in components/ui
// (Toggle, Field, Button); this file keeps only the settings card.

/** A settings card. `action` sits at the right of the title (for example, an Add button). */
export function Section({
  title,
  children,
  t,
  action,
}: {
  title: string;
  children: React.ReactNode;
  t: ResolvedTheme;
  action?: React.ReactNode;
}) {
  const heading = (
    <h2
      style={{
        fontSize: "15px",
        fontWeight: 700,
        color: t.textPrimary,
        marginBottom: action ? 0 : "20px",
      }}
    >
      {title}
    </h2>
  );
  return (
    <EventCard
      theme={t}
      style={{
        padding: "20px",
      }}
    >
      {action ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {children}
    </EventCard>
  );
}
