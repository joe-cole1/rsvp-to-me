import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ResolvedTheme } from "@/lib/theme";
import { guestCountLabel, isGuestRowShown, type GuestStatusDisplay } from "@/lib/guestRsvpDisplay";

/**
 * A row count as text. A capped "3+" also carries "3 or more" for screen
 * readers, so the plus sign is never read on its own.
 */
export function GuestCountText({ label }: { label: string }) {
  const shared = useTranslations("Ui.Event.shared");
  if (!label.endsWith("+")) return <>{label}</>;
  return (
    <>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{shared("countAtLeast", { count: label.slice(0, -1) })}</span>
    </>
  );
}

export function GuestRsvpGroup({
  label,
  count,
  display,
  t,
  children,
}: {
  label: string;
  count: number;
  display: GuestStatusDisplay;
  t: ResolvedTheme;
  children: ReactNode;
}) {
  if (!isGuestRowShown(display)) return null;
  const countLabel = guestCountLabel(count, display);
  const heading = (
    <>
      {label}
      {countLabel !== null && (
        <>
          {" · "}
          <GuestCountText label={countLabel} />
        </>
      )}
    </>
  );
  const headingStyle = {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: t.textMuted,
    marginBottom: "8px",
  };

  // Count only: the heading stands alone and no names render.
  if (display.list === "HIDDEN") {
    return (
      <div style={{ marginBottom: "14px" }}>
        <div style={headingStyle}>{heading}</div>
      </div>
    );
  }

  return display.list === "COLLAPSED" ? (
    <details style={{ marginBottom: "14px" }}>
      <summary style={{ ...headingStyle, cursor: "pointer" }}>{heading}</summary>
      {children}
    </details>
  ) : (
    <div style={{ marginBottom: "14px" }}>
      <div style={headingStyle}>{heading}</div>
      {children}
    </div>
  );
}
