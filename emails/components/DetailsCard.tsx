import type { EmailTheme } from "@/lib/email-theme";
import {
  buildGoogleCalendarUrl,
  buildGoogleMapsUrl,
  formatEventDateTime,
  icsUrlForEvent,
  type CalendarEventInput,
} from "@/lib/calendar";

export type EventEmailDetails = CalendarEventInput & {
  timezone?: string;
  locationType?: "PHYSICAL" | "VIRTUAL" | "TBD";
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr style={{ marginBottom: "2px" }}>
      <td style={{ width: "32px", verticalAlign: "top" }}>
        <p style={{ margin: "2px 0", fontSize: "16px", lineHeight: "22px" }}>{label}</p>
      </td>
      <td style={{ verticalAlign: "top" }}>{children}</td>
    </tr>
  );
}

/** Structured date/time + location card with optional map and calendar links. */
export function DetailsCard({
  theme,
  event,
  showMapLink = true,
  showCalendarLinks = true,
}: {
  theme: EmailTheme;
  event: EventEmailDetails;
  showMapLink?: boolean;
  showCalendarLinks?: boolean;
}) {
  const { date, time } = formatEventDateTime(event.startAt, event.endAt, event.timezone);
  const isVirtual = event.locationType === "VIRTUAL";
  const mapQuery = [event.locationName, event.locationAddress].filter(Boolean).join(", ");

  const textStyle = {
    margin: "2px 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: theme.textPrimary,
  };
  const subStyle = { ...textStyle, color: theme.textSecondary };
  const linkStyle = { color: theme.accent, textDecoration: "underline" };

  return (
    <table
      align="center"
      width="100%"
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      className="dm-block"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: theme.cardRadius,
        padding: "16px 18px",
        margin: "20px 0 0",
      }}
    >
      <tbody>
        <DetailRow label="📅">
          <p className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
            {date}
          </p>
          <p className="dm-text-secondary" style={subStyle}>
            {time}
          </p>
        </DetailRow>

        {isVirtual ? (
          <DetailRow label="💻">
            <p className="dm-text-primary" style={textStyle}>
              {event.locationName || "Virtual event"}
            </p>
            {event.virtualUrl ? (
              <p style={subStyle}>
                <a
                  href={event.virtualUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Join link
                </a>
              </p>
            ) : null}
          </DetailRow>
        ) : event.locationName || event.locationAddress ? (
          <DetailRow label="📍">
            <p className="dm-text-primary" style={{ ...textStyle, fontWeight: "600" }}>
              {event.locationName || event.locationAddress}
            </p>
            {event.locationName && event.locationAddress ? (
              <p className="dm-text-secondary" style={subStyle}>
                {event.locationAddress}
              </p>
            ) : null}
            {showMapLink && mapQuery ? (
              <p style={subStyle}>
                <a
                  href={buildGoogleMapsUrl(mapQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={linkStyle}
                >
                  Open in Google Maps
                </a>
              </p>
            ) : null}
          </DetailRow>
        ) : null}

        {showCalendarLinks ? (
          <DetailRow label="🗓️">
            <p style={subStyle}>
              Add to calendar:{" "}
              <a
                href={buildGoogleCalendarUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Google
              </a>
              {" · "}
              <a
                href={icsUrlForEvent(event.slug)}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                Apple / Outlook (.ics)
              </a>
            </p>
          </DetailRow>
        ) : null}
      </tbody>
    </table>
  );
}
